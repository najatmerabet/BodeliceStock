import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';

const router = Router();

// GET /api/stock-usine
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateDebut, dateFin } = req.query;

    let dateFilter: any = {};
    if (dateDebut || dateFin) {
      dateFilter.date = {};
      if (dateDebut) dateFilter.date.gte = new Date(String(dateDebut));
      if (dateFin) {
        const dFin = new Date(String(dateFin));
        dFin.setHours(23, 59, 59, 999);
        dateFilter.date.lte = dFin;
      }
    }

    // Récupérer tous les produits
    const produits = await prisma.produit.findMany({
      orderBy: { categorie: 'asc' } // Grouper par catégorie
    });

    // Récupérer tous les mouvements filtrés par date
    const mouvements = await prisma.stockMouvement.findMany({
      where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
    });

    // Récupérer tous les transferts historiques pour calculer les stocks actuels Tanger/Marrakech
    const transferts = await prisma.stockMouvement.findMany({
      where: { type: 'TRANSFERT' }
    });

    const transferMap = new Map<number, number>();
    for (const t of transferts) {
      const pid = t.produitId;
      const d = Number(t.delta);
      transferMap.set(pid, (transferMap.get(pid) || 0) + d);
    }

    const result = produits.map(p => {
      // Filtrer les mouvements pour ce produit
      const mvtsProduit = mouvements.filter(m => m.produitId === p.id);

      // Entrées = type ENTREE + type BL_SUPPRESSION (restauration)
      const entrees = mvtsProduit
        .filter(m => m.type === 'ENTREE' || m.type === 'BL_SUPPRESSION')
        .reduce((sum, m) => sum + Number(m.delta), 0);

      // Sorties = type BL_CREATION + type AJUSTEMENT (négatif)
      // On convertit en valeur absolue pour l'affichage
      const sorties = mvtsProduit
        .filter(m => m.type === 'BL_CREATION' || (m.type === 'AJUSTEMENT' && Number(m.delta) < 0))
        .reduce((sum, m) => sum + Math.abs(Number(m.delta)), 0);

      const stockFinal = Number(p.quantite);
      const stockMarrakech = transferMap.get(p.id) || 0;
      const stockTanger = stockFinal - stockMarrakech;
      const entreesTotal = stockFinal + sorties;

      return {
        id: p.id,
        reference: p.reference,
        nom: p.nom,
        categorie: p.categorie || 'SANS CATÉGORIE',
        poidsUnitaire: Number(p.poidsUnitaire),
        unite: p.unite,
        entrees: entreesTotal,
        sorties,
        stockFinal,
        stockTanger,
        stockMarrakech
      };
    });

    // Trier par catégorie puis par nom
    result.sort((a, b) => {
      if (a.categorie === b.categorie) {
        return a.nom.localeCompare(b.nom);
      }
      return a.categorie.localeCompare(b.categorie);
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
