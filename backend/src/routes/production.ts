import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';

const router = Router();

// GET /api/production
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
      orderBy: { categorie: 'asc' }
    });

    // Récupérer toutes les entrées (mouvements de type ENTREE ou AJUSTEMENT positif)
    const mouvements = await prisma.stockMouvement.findMany({
      where: {
        AND: [
          dateFilter,
          {
            OR: [
              { type: 'ENTREE' },
              { type: 'AJUSTEMENT', delta: { gt: 0 } }
            ]
          }
        ]
      },
      orderBy: { date: 'asc' }
    });

    // Organiser les données pour le tableau matrice
    // { "2025-05-22": { [produitId]: quantite } }
    const matrix: { [date: string]: { [produitId: number]: number } } = {};
    const datesSet = new Set<string>();

    mouvements.forEach(m => {
      // Formater la date en string locale 'YYYY-MM-DD'
      const dateStr = m.date.toISOString().split('T')[0];
      datesSet.add(dateStr);

      if (!matrix[dateStr]) {
        matrix[dateStr] = {};
      }
      
      const qte = Number(m.delta);
      if (!matrix[dateStr][m.produitId]) {
        matrix[dateStr][m.produitId] = qte;
      } else {
        matrix[dateStr][m.produitId] += qte;
      }
    });

    // Formater la réponse
    const sortedDates = Array.from(datesSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Plus récent en haut
    
    const formattedProduits = produits.map(p => ({
      id: p.id,
      nom: p.nom,
      categorie: p.categorie || 'SANS CATÉGORIE',
      poidsUnitaire: Number(p.poidsUnitaire),
      unite: p.unite
    })).sort((a, b) => {
      if (a.categorie === b.categorie) {
        return a.poidsUnitaire - b.poidsUnitaire; // Trier par poids dans la même catégorie
      }
      return a.categorie.localeCompare(b.categorie);
    });

    res.json({
      dates: sortedDates,
      produits: formattedProduits,
      data: matrix
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/production/entree
router.post('/entree', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { produitId, quantite, date } = req.body;

    if (!produitId || !quantite || quantite <= 0) {
      return res.status(400).json({ error: 'Produit et quantité valide obligatoires' });
    }

    const produit = await prisma.produit.findUnique({ where: { id: Number(produitId) } });
    if (!produit) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const ancienneQte = Number(produit.quantite);
    const delta = Number(quantite);
    const nouvelleQte = ancienneQte + delta;

    const dateMvt = date ? new Date(date) : new Date();

    const mvt = await prisma.$transaction(async (tx) => {
      // Mettre à jour le stock du produit
      await tx.produit.update({
        where: { id: produit.id },
        data: { quantite: nouvelleQte }
      });

      // Créer le mouvement
      return await tx.stockMouvement.create({
        data: {
          produitId: produit.id,
          type: 'ENTREE',
          ancienneQte,
          nouvelleQte,
          delta,
          motif: 'Ajout depuis la page Production',
          date: dateMvt
        }
      });
    });

    await createLog({
      action: 'UPDATE',
      entity: 'Produit',
      entityId: produit.id,
      description: `Entrée en stock (+${delta} ${produit.unite}) via Production`,
      userId: (req as any).user?.userId,
    });

    res.json(mvt);
  } catch (error) {
    next(error);
  }
});

export default router;
