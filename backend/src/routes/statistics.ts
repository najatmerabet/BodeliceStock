import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import { authMiddleware } from './auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/stats', async (req, res) => {

  const produits = await prisma.produit.count();
  const clients = await prisma.client.count();
  const factures = await prisma.facture.count();
  const livraisons = await prisma.bonLivraison.count();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);

  const revenus = await prisma.facture.aggregate({
    _sum: { total: true },
    where: {
      date: { gte: startOfMonth }
    }
  });

  const stock = await prisma.produit.aggregate({
    _sum: {
      quantite: true
    }
  });

  res.json({
    produits,
    clients,
    factures,
    livraisons,
    revenusMensuel: revenus._sum.total || 0,
    stockTotal: stock._sum.quantite || 0
  });
});
export default router;