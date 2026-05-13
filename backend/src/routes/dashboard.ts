import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
const router = Router();

router.get('/summary', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [produits, clients, blCount, factureCount, proformaCount, avoirCount] = await Promise.all([
      prisma.produit.findMany({ orderBy: { quantite: 'asc' } }),
      prisma.client.count(),
      prisma.bonLivraison.count(),
      prisma.facture.count(),
      prisma.factureProforma.count(),
      prisma.factureAvoir.count(),
    ]);

    const totalProduits = produits.length;
    const stockFaible = produits.filter(p => Number(p.quantite) < 5).length;

    // Valeur totale du stock
    const valeurStock = produits.reduce((acc, p) => {
      return acc + (Number(p.quantite) * Number(p.poidsUnitaire) * Number(p.prixUnitaire));
    }, 0);
    const rawPaiements = await prisma.paiement.findMany({
  select: {
    montant: true,
    date: true
  }
});
    // Poids total en kg
    const poidsTotal = produits.reduce((acc, p) => {
      return acc + (Number(p.quantite) * Number(p.poidsUnitaire));
    }, 0);

    // Top 5 produits par valeur
    const topProduits = [...produits]
      .map(p => ({
        id: p.id,
        reference: p.reference,
        nom: p.nom,
        unite: p.unite,
        quantite: Number(p.quantite),
        poidsUnitaire: Number(p.poidsUnitaire),
        prixUnitaire: Number(p.prixUnitaire),
        valeur: Number(p.quantite) * Number(p.poidsUnitaire) * Number(p.prixUnitaire),
      }))
      .sort((a, b) => b.valeur - a.valeur)
      .slice(0, 5);

    // Alertes stock
    const alertes = produits
      .filter(p => Number(p.quantite) < 10) // Alerte si moins de 10 unités
      .map(p => ({
        id: p.id,
        reference: p.reference,
        nom: p.nom,
        quantite: Number(p.quantite),
        unite: p.unite,
      }));

      const rawRevenus = await prisma.facture.findMany({
  select: {
    total: true,
    date: true
  }
});

const revenusMap: Record<string, number> = {};

rawRevenus.forEach(f => {
  const mois = new Date(f.date).toLocaleString('fr-FR', { month: 'short' });

  if (!revenusMap[mois]) revenusMap[mois] = 0;
  revenusMap[mois] += Number(f.total);
});

const revenusParMois = Object.keys(revenusMap).map(mois => ({
  mois,
  montant: revenusMap[mois]
}));
const livraisonsParStatut = await prisma.facture.groupBy({
  by: ['statut'],
  _count: true
});

    // Répartition par catégorie
    const categories: Record<string, { count: number; valeur: number }> = {};
    produits.forEach(p => {
      const cat = p.reference.startsWith('SA') ? 'SACHETS' : (p.reference.startsWith('SH') ? 'SHAWARMA' : 'AUTRE');
      if (!categories[cat]) categories[cat] = { count: 0, valeur: 0 };
      categories[cat].count++;
      categories[cat].valeur += Number(p.quantite) * Number(p.poidsUnitaire) * Number(p.prixUnitaire);
    });

    res.json({
      produits: totalProduits,
      clients,
      livraisons: blCount,
      factures: factureCount,
      proformas: proformaCount,
      avoirs: avoirCount,
      stockFaible,
      valeurStock: Math.round(valeurStock * 100) / 100,
      poidsTotal: Math.round(poidsTotal * 100) / 100,
      topProduits,
      alertes,
      categories,
      revenusParMois:rawPaiements,
      livraisonsParStatut: livraisonsParStatut,
    });
  } catch (error) {
    next(error);
  }
});


export default router;
