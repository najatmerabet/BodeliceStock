import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

// Génère le prochain numéro BL : BL-0001, BL-0002...
async function generateNumeroBL(): Promise<string> {
  const last = await prisma.bonLivraison.findFirst({
    orderBy: { id: 'desc' },
  });
  const nextNum = last ? last.id + 1 : 1;
  return `BL-${String(nextNum).padStart(4, '0')}`;
}

// GET /api/bons-livraison — Liste tous les BLs
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bls = await prisma.bonLivraison.findMany({
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(bls);
  } catch (error) {
    next(error);
  }
});

// GET /api/bons-livraison/:id — Un BL avec ses lignes
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bl = await prisma.bonLivraison.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        client: true,
        lignes: { include: { produit: true } },
      },
    });
    if (!bl) {
      res.status(404).json({ error: 'Bon de livraison non trouvé' });
      return;
    }
    res.json(bl);
  } catch (error) {
    next(error);
  }
});

// POST /api/bons-livraison — Créer un BL avec ses lignes
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, lignes } = req.body;

    if (!clientId || !lignes || !Array.isArray(lignes) || lignes.length === 0) {
      res.status(400).json({ error: 'clientId et lignes[] sont obligatoires' });
      return;
    }

    // Vérifier le stock avant de créer
    for (const l of lignes) {
      const produit = await prisma.produit.findUnique({ where: { id: l.produitId } });
      if (!produit) {
        res.status(400).json({ error: `Produit id=${l.produitId} non trouvé` });
        return;
      }
      if (Number(produit.quantite) < l.quantite) {
        res.status(400).json({
          error: `Stock insuffisant pour "${produit.nom}" — dispo: ${produit.quantite} unités, demandé: ${l.quantite}`,
        });
        return;
      }
    }

    const numero = await generateNumeroBL();

    // Calculer le total de chaque ligne et le total global
    let totalBL = 0;
    const lignesData = lignes.map((l: any) => {
      const totalLigne = l.quantite * l.prix;
      totalBL += totalLigne;
      return {
        produitId: l.produitId,
        quantite: l.quantite,
        prix: l.prix,
        total: totalLigne,
      };
    });

    const bl = await prisma.bonLivraison.create({
      data: {
        numero,
        clientId,
        total: totalBL,
        lignes: { create: lignesData },
      },
      include: {
        client: true,
        lignes: { include: { produit: true } },
      },
    });

    // Déduire le stock pour chaque produit
    for (const ligne of lignesData) {
      await prisma.produit.update({
        where: { id: ligne.produitId },
        data: { stock: { decrement: ligne.quantite } },
      });
    }

    res.status(201).json(bl);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bons-livraison/:id — Supprimer un BL (restaure le stock)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bl = await prisma.bonLivraison.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { lignes: true },
    });
    if (!bl) {
      res.status(404).json({ error: 'Bon de livraison non trouvé' });
      return;
    }

    // Restaurer le stock avant suppression
    for (const ligne of bl.lignes) {
      await prisma.produit.update({
        where: { id: ligne.produitId },
        data: { stock: { increment: ligne.quantite } },
      });
    }

    await prisma.bonLivraison.delete({
      where: { id: parseInt(String(req.params.id)) },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
