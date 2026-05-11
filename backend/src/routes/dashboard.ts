import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
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
    });
  } catch (error) {
    next(error);
  }
});

export default router;
