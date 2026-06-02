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

    // Récupérer tous les transferts pour calculer stock Tanger/Marrakech
    const transferts = await prisma.stockMouvement.findMany({
      where: { type: 'TRANSFERT' }
    });

    const transferMap = new Map<number, number>();
    for (const t of transferts) {
      transferMap.set(t.produitId, (transferMap.get(t.produitId) || 0) + Number(t.delta));
    }

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
    
    const formattedProduits = produits.map(p => {
      const stockTotal = Number(p.quantite);
      const stockMarrakech = transferMap.get(p.id) || 0;
      const stockTanger = stockTotal - stockMarrakech;
      return {
        id: p.id,
        nom: p.nom,
        categorie: p.categorie || 'SANS CATÉGORIE',
        poidsUnitaire: Number(p.poidsUnitaire),
        unite: p.unite,
        stockTotal,
        stockTanger,
        stockMarrakech
      };
    }).sort((a, b) => {
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

async function generateNumeroBL(): Promise<string> {
  const all = await prisma.bonLivraison.findMany({ select: { numero: true }, orderBy: { numero: 'asc' } });
  const usedNums = new Set(
    all.map(bl => parseInt(bl.numero.replace('BL-', ''), 10)).filter(n => !isNaN(n))
  );
  let num = 1;
  while (usedNums.has(num)) num++;
  return `BL-${String(num).padStart(4, '0')}`;
}

// POST /api/production/transfert
router.post('/transfert', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lignes } = req.body;

    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'lignes[] est obligatoire' });
    }

    // Validation
    for (const l of lignes) {
      const n = Number(l.nbUnites);
      if (isNaN(n) || n <= 0) {
        return res.status(400).json({ error: `Nombre d'unités invalide pour le produit ${l.produitId}` });
      }
    }

    // Trouver ou créer le client PRODMEAT-MARRAKECH
    let client = await prisma.client.findFirst({
      where: { nom: 'PRODMEAT-MARRAKECH' }
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          nom: 'PRODMEAT-MARRAKECH',
          reference: 'PRODMEAT-MARRAKECH',
          adresse: 'PRODMEAT-MARRAKECH',
          ville: 'Marrakech'
        }
      });
    }

    const numero = await generateNumeroBL();

    let totalBL = 0;
    const lignesData: any[] = [];

    for (const l of lignes) {
      const prod = await prisma.produit.findUnique({ where: { id: Number(l.produitId) } });
      if (!prod) {
        return res.status(404).json({ error: `Produit id=${l.produitId} non trouvé` });
      }

      const n = Number(l.nbUnites);
      const pu = Number(l.poidsUnitaire || prod.poidsUnitaire || 1);
      const q = n * pu;
      const pr = Number(l.prix || prod.prixUnitaire || 0);
      const totalLigne = q * pr;
      totalBL += totalLigne;

      lignesData.push({
        produitId: prod.id,
        nbUnites: n,
        poidsUnitaire: pu,
        quantite: q,
        prix: pr,
        total: totalLigne
      });
    }

    const newBl = await prisma.$transaction(async (tx) => {
      // Créer le BL de type TRANSFERT
      const bl = await tx.bonLivraison.create({
        data: {
          numero,
          clientId: client.id,
          total: totalBL,
          type: 'TRANSFERT',
          lignes: { create: lignesData },
        },
        include: { client: true, lignes: { include: { produit: true } } },
      });

      // Créer les mouvements de type TRANSFERT sans modifier la quantité globale du produit
      for (const l of lignesData) {
        const prod = await tx.produit.findUnique({ where: { id: l.produitId } });
        const currentQte = Number(prod?.quantite || 0);

        await tx.stockMouvement.create({
          data: {
            produitId: l.produitId,
            type: 'TRANSFERT',
            ancienneQte: currentQte,
            nouvelleQte: currentQte,
            delta: l.nbUnites,
            motif: `Transfert Tanger -> Marrakech (BL ${bl.numero})`,
          },
        });
      }

      return bl;
    });

    await createLog({
      action: 'CREATE',
      entity: 'BonLivraison',
      entityId: newBl.id,
      description: `Transfert Tanger -> Marrakech créé (BL: ${newBl.numero})`,
      userId: (req as any).user?.userId,
    });

    res.status(201).json(newBl);
  } catch (error) {
    next(error);
  }
});

export default router;

