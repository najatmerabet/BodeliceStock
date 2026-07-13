import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { createLog } from '../services/log.service';
import { authMiddleware } from './auth.middleware';
const router = Router();

// Génère le prochain numéro facture : FA-0001, FA-0002... (comble les trous)
async function generateNumeroFacture(): Promise<string> {
  const all = await prisma.facture.findMany({ select: { numero: true }, orderBy: { numero: 'asc' } });
  const usedNums = new Set(
    all.map(f => parseInt(f.numero.replace('FA-', ''), 10)).filter(n => !isNaN(n))
  );
  let num = 1;
  while (usedNums.has(num)) num++;
  return `FA-${String(num).padStart(4, '0')}`;
}

// GET /api/factures — Liste toutes les factures
router.get('/', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const factures = await prisma.facture.findMany({
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(factures);
  } catch (error) {
    next(error);
  }
});

// GET /api/factures/releve/:clientId?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
// Retourne TOUTES les factures d'un client (pour le relevé de compte)
router.get('/releve/:clientId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(String(req.params.clientId));
    const { dateFrom, dateTo } = req.query;

    const where: any = { clientId };

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(String(dateFrom));
      if (dateTo) {
        const end = new Date(String(dateTo));
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      res.status(404).json({ error: 'Client non trouvé' });
      return;
    }

    const factures = await prisma.facture.findMany({
      where,
      include: { paiements: { orderBy: { date: 'asc' } } },
      orderBy: { date: 'asc' },
    });

    const totalFacture = factures.reduce((s, f) => s + Number(f.total), 0);
    const totalPaye   = factures.reduce((s, f) => s + Number(f.paye),  0);
    const totalReste  = factures.reduce((s, f) => s + Number(f.reste), 0);

    res.json({
      client,
      factures,
      totaux: { totalFacture, totalPaye, totalReste },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});


// GET /api/factures/:id — Une facture avec ses BLs et produits
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const facture = await prisma.facture.findUnique({
      where: { id },
      include: { 
        client: true,
        bonsLivraison: {
          include: {
            lignes: { include: { produit: true } }
          }
        },
        avoirs: true,
        proforma: { include: { lignes: { include: { produit: true } } } },
        paiements: { orderBy: { date: 'desc' } },
      },
    });
    if (!facture) {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }

    res.json(facture);
  } catch (error) {
    next(error);
  }
});

// POST /api/factures/generate-from-bls — Créer une facture à partir de plusieurs BLs
router.post('/generate-from-bls', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { blIds } = req.body;
    if (!Array.isArray(blIds) || blIds.length === 0) {
      res.status(400).json({ error: 'Liste de blIds requise' });
      return;
    }

    const bls = await prisma.bonLivraison.findMany({
      where: { id: { in: blIds.map(Number) } },
      include: { client: true }
    });

    if (bls.length === 0) {
      res.status(404).json({ error: 'Aucun BL trouvé' });
      return;
    }

    // Vérifier si tous les BLs appartiennent au même client
    const clientId = bls[0].clientId;
    if (bls.some(b => b.clientId !== clientId)) {
      res.status(400).json({ error: 'Tous les BLs doivent appartenir au même client' });
      return;
    }

    // Vérifier si des BLs sont déjà facturés
    if (bls.some(b => b.statut === 'FACTURÉ')) {
      res.status(400).json({ error: 'Certains BLs sont déjà facturés' });
      return;
    }

    // Calculer les totaux avec TVA (basé sur le produit actuel)
    let totalHT = 0;
    let totalTVA = 0;
    
    // On recharge les BLs avec les lignes et produits pour le calcul
    const fullBls = await prisma.bonLivraison.findMany({
      where: { id: { in: blIds.map(Number) } },
      include: { lignes: { include: { produit: true } } }
    });

    for (const bl of fullBls) {
      for (const l of bl.lignes) {
        const ht = Number(l.total); // total ligne BL est HT (q * p)
        const tvaRate = Number(l.produit.tva || 0);
        const tvaAmount = ht * (tvaRate / 100);
        totalHT += ht;
        totalTVA += tvaAmount;
      }
    }
    const totalTTC = totalHT + totalTVA;

    const numero = await generateNumeroFacture();

    const facture = await prisma.$transaction(async (tx) => {
      const newFacture = await tx.facture.create({
        data: {
          numero,
          clientId,
          totalHT,
          totalTVA,
          total: totalTTC,
          reste: totalTTC,
          statut: 'impayée',
        }
      });

      // Mettre à jour les BLs
      await tx.bonLivraison.updateMany({
        where: { id: { in: bls.map(b => b.id) } },
        data: { 
          statut: 'FACTURÉ',
          factureId: newFacture.id 
        }
      });

      return newFacture;
    });
    await createLog({
      action: 'CREATE',
      entity: 'Facture',
      entityId: facture.id,
      description: `Facture créée à partir de BLs: ${facture.numero}`,
      userId: (req as any).user?.userId,
    });
    res.status(201).json(facture);
  } catch (error) {
    next(error);
  }
});

// POST /api/factures — Créer une facture manuelle (legacy or simple)
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, total, paye } = req.body;
    if (!clientId || total === undefined) {
      res.status(400).json({ error: 'clientId et total sont obligatoires' });
      return;
    }

    const numero = await generateNumeroFacture();
    const payeAmount = paye || 0;
    const reste = total - payeAmount;
    let statut = 'impayée';
    if (reste <= 0) statut = 'payée';
    else if (payeAmount > 0) statut = 'partielle';

    const facture = await prisma.facture.create({
      data: {
        numero,
        clientId: Number(clientId),
        total,
        paye: payeAmount,
        reste: Math.max(0, reste),
        statut,
      },
      include: { client: true },
    });
    await createLog({
      action: 'CREATE',
      entity: 'Facture',
      entityId: facture.id,
      description: `Facture créée: ${facture.numero}`,
      userId: (req as any).user?.userId,
    });
    res.status(201).json(facture);
  } catch (error) {
    next(error);
  }
});

// PUT /api/factures/:id/payer — Ajouter un paiement
router.put('/:id/payer', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { montant, methode, remarque } = req.body;
    if (!montant || Number(montant) <= 0) {
      res.status(400).json({ error: 'montant doit être supérieur à 0' });
      return;
    }

    const validMethodes = ['ESPECE', 'CHEQUE', 'VIREMENT'];
    if (methode && !validMethodes.includes(methode)) {
      res.status(400).json({ error: 'methode invalide: ESPECE, CHEQUE ou VIREMENT' });
      return;
    }

    const facture = await prisma.facture.findUnique({
      where: { id: parseInt(String(req.params.id)) },
    });
    if (!facture) {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }

    if (facture.statut === 'payée') {
      res.status(400).json({ error: 'Cette facture est déjà payée' });
      return;
    }

    const newPaye = Number(facture.paye) + Number(montant);
    const newReste = Number(facture.total) - newPaye;
    let newStatut = 'impayée';
    if (newReste <= 0) newStatut = 'payée';
    else if (newPaye > 0) newStatut = 'partielle';

    const [updated] = await prisma.$transaction([
      prisma.facture.update({
        where: { id: parseInt(String(req.params.id)) },
        data: {
          paye: newPaye,
          reste: Math.max(0, newReste),
          statut: newStatut,
        },
      }),
      prisma.paiement.create({
        data: {
          factureId: Number(facture.id),
          montant: Number(montant),
          methode: methode || 'ESPECE',
          remarque: remarque || null,
        },
      }),
    ]);

    const full = await prisma.facture.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { 
        client: true, 
        paiements: { orderBy: { date: 'desc' } },
        avoirs: true,
        proforma: { include: { lignes: { include: { produit: true } } } },
        bonsLivraison: { include: { lignes: { include: { produit: true } } } },
      },
    });
      await createLog({
      action: 'UPDATE',
      entity: 'Facture',
      entityId: parseInt(String(req.params.id)),
      description: `Paiement de facture ${facture?.numero} pour ${montant} MAD via ${methode || 'ESPECE'} - Statut: ${newStatut} - Reste: ${Math.max(0, newReste)} MAD`,
      userId: (req as any).user?.userId,
    });
    res.json(full);
  } catch (error) {
    next(error);
  }
});

// POST /api/factures/historique — Créer une facture depuis un ancien système (sans impact stock)
router.post('/historique', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, date, referenceExterne, paye, lignes, totalManuel } = req.body;

    if (!clientId) {
      res.status(400).json({ error: 'clientId est obligatoire' });
      return;
    }

    const payeAmount   = Number(paye || 0);
    const dateFacture  = date ? new Date(date) : new Date();
    const numero       = await generateNumeroFacture();

    // ── Fonction de calcul ligne (identique aux proformas) ──
    function calcLigne(q: number, prix: number, remise: number, tva: number) {
      const totalAvantRemise  = q * prix;
      const montantRemise     = totalAvantRemise * (remise / 100);
      const totalApresRemise  = totalAvantRemise - montantRemise;
      const montantTVA        = totalApresRemise * (tva / 100);
      const totalTTC          = totalApresRemise + montantTVA;
      return { totalAvantRemise, totalApresRemise, totalTVA: montantTVA, totalTTC };
    }

    if (lignes && Array.isArray(lignes) && lignes.length > 0) {
      // ── Mode AVEC lignes produits : on crée une FactureProforma interne ──
      const lignesData = lignes.map((l: any) => {
        const q     = Number(l.quantite || 0);
        const prix  = Number(l.prix || 0);
        const remise = Number(l.remise || 0);
        const tva   = Number(l.tva || 0);
        const calc  = calcLigne(q, prix, remise, tva);
        return {
          produitId:      Number(l.produitId),
          quantite:       q,
          prix,
          remise,
          tva,
          nbUnites:       l.nbUnites      ? Number(l.nbUnites)      : null,
          poidsUnitaire:  l.poidsUnitaire ? Number(l.poidsUnitaire) : null,
          ...calc,
        };
      });

      const totalHT     = lignesData.reduce((s, l) => s + l.totalAvantRemise, 0);
      const totalRemise = lignesData.reduce((s, l) => s + (l.totalAvantRemise - l.totalApresRemise), 0);
      const totalTVA    = lignesData.reduce((s, l) => s + l.totalTVA, 0);
      const totalTTC    = lignesData.reduce((s, l) => s + l.totalTTC, 0);

      // Générer numéro proforma
      const allProformas = await prisma.factureProforma.findMany({ select: { numero: true }, orderBy: { numero: 'asc' } });
      const usedNums = new Set(allProformas.map(p => parseInt(p.numero.replace('FP-', ''), 10)).filter(n => !isNaN(n)));
      let numFP = 1;
      while (usedNums.has(numFP)) numFP++;
      const proformaNumero = `FP-${String(numFP).padStart(4, '0')}`;

      const reste  = Math.max(0, totalTTC - payeAmount);
      let statut   = 'impayée';
      if (reste <= 0)         statut = 'payée';
      else if (payeAmount > 0) statut = 'partielle';

      const facture = await prisma.$transaction(async (tx) => {
        // Créer la proforma interne (statut FACTURÉE directement, pas visible dans le flux normal)
        const proforma = await tx.factureProforma.create({
          data: {
            numero:       proformaNumero,
            clientId:     Number(clientId),
            date:         dateFacture,
            totalHT,
            totalRemise,
            totalTVA,
            totalTTC,
            statut:       'FACTURÉE',
            lignes:       { create: lignesData },
          },
        });

        // Créer la facture HISTORIQUE liée à la proforma
        const newFacture = await tx.facture.create({
          data: {
            numero,
            clientId:         Number(clientId),
            date:             dateFacture,
            type:             'HISTORIQUE',
            referenceExterne: referenceExterne || null,
            proformaId:       proforma.id,
            totalHT,
            totalRemise,
            totalTVA,
            total:            totalTTC,
            paye:             payeAmount,
            reste,
            statut,
          },
          include: { client: true },
        });

        // Si déjà partiellement payé, enregistrer le paiement initial
        if (payeAmount > 0) {
          await tx.paiement.create({
            data: {
              factureId: newFacture.id,
              montant:   payeAmount,
              methode:   'ESPECE',
              remarque:  'Solde initial (import historique)',
              date:      dateFacture,
            },
          });
        }

        return newFacture;
      });

      await createLog({
        action:      'CREATE',
        entity:      'Facture',
        entityId:    facture.id,
        description: `Facture historique créée avec ${lignes.length} ligne(s): ${facture.numero}`,
        userId:      (req as any).user?.userId,
      });

      res.status(201).json(facture);

    } else {
      // ── Mode SANS lignes : montant global uniquement ──
      if (!totalManuel || Number(totalManuel) <= 0) {
        res.status(400).json({ error: 'totalManuel est requis si aucune ligne de produit n\'est fournie' });
        return;
      }

      const total  = Number(totalManuel);
      const reste  = Math.max(0, total - payeAmount);
      let statut   = 'impayée';
      if (reste <= 0)         statut = 'payée';
      else if (payeAmount > 0) statut = 'partielle';

      const facture = await prisma.$transaction(async (tx) => {
        const newFacture = await tx.facture.create({
          data: {
            numero,
            clientId:         Number(clientId),
            date:             dateFacture,
            type:             'HISTORIQUE',
            referenceExterne: referenceExterne || null,
            total,
            paye:             payeAmount,
            reste,
            statut,
          },
          include: { client: true },
        });

        if (payeAmount > 0) {
          await tx.paiement.create({
            data: {
              factureId: newFacture.id,
              montant:   payeAmount,
              methode:   'ESPECE',
              remarque:  'Solde initial (import historique)',
              date:      dateFacture,
            },
          });
        }

        return newFacture;
      });

      await createLog({
        action:      'CREATE',
        entity:      'Facture',
        entityId:    facture.id,
        description: `Facture historique créée (montant global): ${facture.numero}`,
        userId:      (req as any).user?.userId,
      });

      res.status(201).json(facture);
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/factures/:id — Supprimer une facture + remettre les BLs en "A FACTURER"
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const facture = await prisma.facture.findUnique({ where: { id } });
    await prisma.$transaction(async (tx) => {
      // Remettre les BLs à zéro
      await tx.bonLivraison.updateMany({
        where: { factureId: id },
        data: { 
          statut: 'A FACTURER',
          factureId: null 
        }
      });

      await tx.facture.delete({
        where: { id },
      });
    });

    await createLog({
      action: 'DELETE',
      entity: 'Facture',
      entityId: id,
      description: `Facture supprimée: ${facture?.numero }`,
      userId: (req as any).user?.userId,
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }
    next(error);
  }
});

const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const endOfMonth = new Date();
endOfMonth.setMonth(endOfMonth.getMonth() + 1);
endOfMonth.setDate(0);

const revenusMensuel = prisma.facture.aggregate({
  _sum: {
    total: true
  },
  where: {
    date: {
      gte: startOfMonth,
      lte: endOfMonth
    }
  }
});

export default router;
