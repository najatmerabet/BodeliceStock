import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

// ── Génère le numéro proforma ──
async function generateNumero(): Promise<string> {
  const last = await prisma.factureProforma.findFirst({ orderBy: { id: 'desc' } });
  const next = last ? last.id + 1 : 1;
  return `FP-${String(next).padStart(4, '0')}`;
}

// ── Calcul totaux d'une ligne proforma ──
function calcLigne(q: number, prix: number, remise: number, tva: number) {
  const totalAvantRemise = q * prix;
  const montantRemise = totalAvantRemise * (remise / 100);
  const totalApresRemise = totalAvantRemise - montantRemise;
  const montantTVA = totalApresRemise * (tva / 100);
  const totalTTC = totalApresRemise + montantTVA;
  return { totalAvantRemise, totalApresRemise, totalTVA: montantTVA, totalTTC };
}

// GET /api/proformas
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[GET] /api/proformas - Debut requete');
    const list = await prisma.factureProforma.findMany({
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    console.log('[GET] /api/proformas - Trouve:', list.length, 'proformas');
    res.json(list);
  } catch (e) { next(e); }
});

// GET /api/proformas/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    console.log('[GET] /api/proformas/:id - id:', id);
    const p = await prisma.factureProforma.findUnique({
      where: { id },
      include: {
        client: true,
        bonsLivraison: { include: { lignes: { include: { produit: true } } } },
        lignes: { include: { produit: true } },
        facture: true,
      },
    });
    console.log('[GET] /api/proformas/:id - trouve:', p ? p.numero : 'null', '- BLs:', p?.bonsLivraison?.length || 0);
    if (!p) { res.status(404).json({ error: 'Proforma non trouvée' }); return; }
    res.json(p);
  } catch (e) { next(e); }
});

// POST /api/proformas/from-bls — Créer proforma depuis BLs
router.post('/from-bls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { blIds } = req.body;
    if (!Array.isArray(blIds) || blIds.length === 0) {
      res.status(400).json({ error: 'blIds[] requis' }); return;
    }

    const bls = await prisma.bonLivraison.findMany({
      where: { id: { in: blIds.map(Number) } },
      include: { lignes: { include: { produit: true } } },
    });
    if (bls.length === 0) { res.status(404).json({ error: 'Aucun BL trouvé' }); return; }

    const clientId = bls[0].clientId;
    if (bls.some(b => b.clientId !== clientId)) {
      res.status(400).json({ error: 'Tous les BLs doivent appartenir au même client' }); return;
    }
    if (bls.some(b => b.statut === 'FACTURÉ')) {
      res.status(400).json({ error: 'Certains BLs sont déjà facturés' }); return;
    }

    // Construire les lignes proforma depuis les lignes BL (remise=0 par défaut)
    const lignesData: any[] = [];
    for (const bl of bls) {
      for (const l of bl.lignes) {
        const q = Number(l.quantite);
        const prix = Number(l.prix);
        const tva = Number(l.produit.tva || 0);
        const calc = calcLigne(q, prix, 0, tva);
        lignesData.push({
          produitId: l.produitId,
          quantite: q,
          prix,
          remise: 0,
          tva,
          nbUnites: l.nbUnites || null,
          poidsUnitaire: l.poidsUnitaire || null,
          ...calc,
        });
      }
    }

    const totalHT = lignesData.reduce((s, l) => s + l.totalAvantRemise, 0);
    const totalRemise = lignesData.reduce((s, l) => s + (l.totalAvantRemise - l.totalApresRemise), 0);
    const totalTVA = lignesData.reduce((s, l) => s + l.totalTVA, 0);
    const totalTTC = lignesData.reduce((s, l) => s + l.totalTTC, 0);
    const numero = await generateNumero();

    const proforma = await prisma.$transaction(async (tx) => {
      const fp = await tx.factureProforma.create({
        data: {
          numero,
          clientId,
          totalHT,
          totalRemise,
          totalTVA,
          totalTTC,
          statut: 'BROUILLON',
          bonsLivraison: { connect: bls.map(b => ({ id: b.id })) },
          lignes: { create: lignesData },
        },
        include: { client: true, lignes: { include: { produit: true } } },
      });

      // Marquer les BLs en PROFORMA
      await tx.bonLivraison.updateMany({
        where: { id: { in: bls.map(b => b.id) } },
        data: { statut: 'PROFORMA', proformaId: fp.id },
      });

      return fp;
    });

    res.status(201).json(proforma);
  } catch (e) { next(e); }
});

// PUT /api/proformas/:id/lignes — Modifier les remises/TVA des lignes
router.put('/:id/lignes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const { lignes } = req.body; // [{ id, remise }]

    const proforma = await prisma.factureProforma.findUnique({
      where: { id }, include: { lignes: { include: { produit: true } } },
    });
    if (!proforma) { res.status(404).json({ error: 'Proforma non trouvée' }); return; }
    if (proforma.statut === 'FACTURÉE') {
      res.status(400).json({ error: 'Impossible de modifier une proforma déjà facturée' }); return;
    }

    // Mettre à jour chaque ligne
    for (const l of lignes) {
      const existing = proforma.lignes.find(pl => pl.id === l.id);
      if (!existing) continue;
      const remise = Number(l.remise ?? existing.remise);
      const tva = Number(l.tva ?? existing.tva);
      const calc = calcLigne(Number(existing.quantite), Number(existing.prix), remise, tva);
      await prisma.ligneProforma.update({
        where: { id: l.id },
        data: { remise, tva, ...calc },
      });
    }

    // Recalculer les totaux
    const updatedLignes = await prisma.ligneProforma.findMany({ where: { proformaId: id } });
    const totalHT = updatedLignes.reduce((s, l) => s + Number(l.totalAvantRemise), 0);
    const totalRemise = updatedLignes.reduce((s, l) => s + (Number(l.totalAvantRemise) - Number(l.totalApresRemise)), 0);
    const totalTVA = updatedLignes.reduce((s, l) => s + Number(l.totalTVA), 0);
    const totalTTC = updatedLignes.reduce((s, l) => s + Number(l.totalTTC), 0);

    const updated = await prisma.factureProforma.update({
      where: { id },
      data: { totalHT, totalRemise, totalTVA, totalTTC },
      include: { client: true, lignes: { include: { produit: true } }, bonsLivraison: true },
    });

    res.json(updated);
  } catch (e) { next(e); }
});

// PUT /api/proformas/:id/valider — Valider la proforma → génère la Facture
router.put('/:id/valider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const proforma = await prisma.factureProforma.findUnique({
      where: { id },
      include: { bonsLivraison: true },
    });
    if (!proforma) { res.status(404).json({ error: 'Proforma non trouvée' }); return; }
    if (proforma.statut === 'FACTURÉE') {
      res.status(400).json({ error: 'Proforma déjà facturée' }); return;
    }

    // Générer numéro facture
    const lastFac = await prisma.facture.findFirst({ orderBy: { id: 'desc' } });
    const nextFac = lastFac ? lastFac.id + 1 : 1;
    const numFac = `FA-${String(nextFac).padStart(4, '0')}`;

    const totalTTC = Number(proforma.totalTTC);

    const result = await prisma.$transaction(async (tx) => {
      // Créer la facture définitive
      const facture = await tx.facture.create({
        data: {
          numero: numFac,
          clientId: proforma.clientId,
          proformaId: id,
          totalHT: proforma.totalHT,
          totalRemise: proforma.totalRemise,
          totalTVA: proforma.totalTVA,
          total: totalTTC,
          paye: 0,
          reste: totalTTC,
          statut: 'impayée',
          bonsLivraison: { connect: proforma.bonsLivraison.map(b => ({ id: b.id })) },
        },
        include: { client: true },
      });

      // Mettre à jour la proforma
      await tx.factureProforma.update({
        where: { id },
        data: { statut: 'FACTURÉE' },
      });

      // Mettre à jour les BLs
      await tx.bonLivraison.updateMany({
        where: { proformaId: id },
        data: { statut: 'FACTURÉ', factureId: facture.id },
      });

      return facture;
    });

    res.json(result);
  } catch (e) { next(e); }
});

// DELETE /api/proformas/:id — Supprimer + remettre BLs en A FACTURER
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const proforma = await prisma.factureProforma.findUnique({ where: { id } });
    if (!proforma) { res.status(404).json({ error: 'Proforma non trouvée' }); return; }
    if (proforma.statut === 'FACTURÉE') {
      res.status(400).json({ error: 'Impossible de supprimer une proforma déjà facturée' }); return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.bonLivraison.updateMany({
        where: { proformaId: id },
        data: { statut: 'A FACTURER', proformaId: null },
      });
      await tx.ligneProforma.deleteMany({ where: { proformaId: id } });
      await tx.factureProforma.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
