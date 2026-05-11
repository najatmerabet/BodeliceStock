import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

async function generateNumeroAvoir(): Promise<string> {
  const last = await prisma.factureAvoir.findFirst({ orderBy: { id: 'desc' } });
  const next = last ? last.id + 1 : 1;
  return `AV-${String(next).padStart(4, '0')}`;
}

// GET /api/avoirs
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await prisma.factureAvoir.findMany({
      include: { facture: { include: { client: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(list);
  } catch (e) { next(e); }
});

// GET /api/avoirs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const avoir = await prisma.factureAvoir.findUnique({
      where: { id },
      include: {
        facture: { include: { client: true } },
        lignes: { include: { produit: true } },
      },
    });
    if (!avoir) { res.status(404).json({ error: 'Avoir non trouvé' }); return; }
    res.json(avoir);
  } catch (e) { next(e); }
});

// POST /api/avoirs — Créer un avoir (retours produits)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { factureId, motif, lignes } = req.body;
    if (!factureId || !Array.isArray(lignes) || lignes.length === 0) {
      res.status(400).json({ error: 'factureId et lignes[] requis' }); return;
    }

    const facture = await prisma.facture.findUnique({ where: { id: Number(factureId) } });
    if (!facture) { res.status(404).json({ error: 'Facture non trouvée' }); return; }

    // Validation des lignes
    for (const l of lignes) {
      const q = Number(l.quantite);
      const p = Number(l.prix);
      if (isNaN(q) || q <= 0) {
        res.status(400).json({ error: `Quantité invalide pour produit ${l.produitId}` }); return;
      }
      if (isNaN(p) || p < 0) {
        res.status(400).json({ error: `Prix invalide pour produit ${l.produitId}` }); return;
      }
    }

    const lignesData = lignes.map((l: any) => ({
      produitId: Number(l.produitId),
      nbUnites: l.nbUnites ? Number(l.nbUnites) : null,
      poidsUnitaire: l.poidsUnitaire ? Number(l.poidsUnitaire) : null,
      quantite: Number(l.quantite),
      prix: Number(l.prix),
      total: Number(l.quantite) * Number(l.prix),
    }));

    const totalAvoir = lignesData.reduce((s, l) => s + l.total, 0);
    const numero = await generateNumeroAvoir();

    const avoir = await prisma.$transaction(async (tx) => {
      // Créer l'avoir
      const av = await tx.factureAvoir.create({
        data: {
          numero,
          factureId: Number(factureId),
          motif: motif || null,
          total: totalAvoir,
          lignes: { create: lignesData },
        },
        include: {
          facture: { include: { client: true } },
          lignes: { include: { produit: true } },
        },
      });

      // Restaurer le stock des produits retournés
      for (const l of lignesData) {
        const prod = await tx.produit.findUnique({ where: { id: l.produitId } });
        const ancienneQte = Number(prod?.quantite || 0);
        const nouvelleQte = ancienneQte + (l.nbUnites || 0);

        await tx.produit.update({
          where: { id: l.produitId },
          data: { quantite: nouvelleQte },
        });

        await tx.stockMouvement.create({
          data: {
            produitId: l.produitId,
            type: 'ENTREE',
            ancienneQte,
            nouvelleQte,
            delta: l.nbUnites || 0,
            motif: `Retour Avoir ${av.numero} (${l.nbUnites} ${prod?.unite}s)`,
          },
        });
      }

      // Réduire le montant de la facture d'origine
      const newReste = Math.max(0, Number(facture.reste) - totalAvoir);
      const newPaye = Number(facture.total) - newReste;
      let newStatut = 'impayée';
      if (newReste <= 0) newStatut = 'payée';
      else if (newPaye > 0) newStatut = 'partielle';

      await tx.facture.update({
        where: { id: Number(factureId) },
        data: { reste: newReste, paye: newPaye, statut: newStatut },
      });

      return av;
    });

    res.status(201).json(avoir);
  } catch (e) { next(e); }
});

// DELETE /api/avoirs/:id — Supprimer avoir + annuler le stock/paiement
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const avoir = await prisma.factureAvoir.findUnique({
      where: { id },
      include: { lignes: true },
    });
    if (!avoir) { res.status(404).json({ error: 'Avoir non trouvé' }); return; }

    const facture = await prisma.facture.findUnique({ where: { id: avoir.factureId } });
    if (!facture) { res.status(404).json({ error: 'Facture liée non trouvée' }); return; }

    await prisma.$transaction(async (tx) => {
      // Réduire stock (annuler le retour)
      for (const l of avoir.lignes) {
        const prod = await tx.produit.findUnique({ where: { id: l.produitId } });
        const ancienneQte = Number(prod?.quantite || 0);
        const nb = Number(l.nbUnites || 0);
        const nouvelleQte = ancienneQte - nb;

        await tx.produit.update({
          where: { id: l.produitId },
          data: { quantite: nouvelleQte },
        });

        await tx.stockMouvement.create({
          data: {
            produitId: l.produitId,
            type: 'AJUSTEMENT',
            ancienneQte,
            nouvelleQte,
            delta: -nb,
            motif: `Déduction (Suppression Avoir ${avoir.numero})`,
          },
        });
      }

      // Remettre le reste de la facture
      const newReste = Math.min(Number(facture.total), Number(facture.reste) + Number(avoir.total));
      const newPaye = Number(facture.total) - newReste;
      let newStatut = 'impayée';
      if (newReste <= 0) newStatut = 'payée';
      else if (newPaye > 0) newStatut = 'partielle';

      await tx.facture.update({
        where: { id: avoir.factureId },
        data: { reste: newReste, paye: newPaye, statut: newStatut },
      });

      await tx.factureAvoir.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
