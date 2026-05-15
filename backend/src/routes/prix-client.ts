import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';

const router = Router();

// GET /api/prix-client/produit/:produitId — Prix spécifiques d'un produit (tous les clients)
router.get('/produit/:produitId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const produitId = parseInt(String(req.params.produitId));
    const list = await prisma.prixClient.findMany({
      where: { produitId },
      include: { client: { select: { id: true, nom: true, ice: true } } },
      orderBy: { client: { nom: 'asc' } },
    });
    res.json(list);
  } catch (e) { next(e); }
});

// GET /api/prix-client/client/:clientId — Prix spécifiques d'un client (tous les produits)
router.get('/client/:clientId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(String(req.params.clientId));
    const list = await prisma.prixClient.findMany({
      where: { clientId },
      include: { produit: { select: { id: true, nom: true, reference: true, prixUnitaire: true, unite: true } } },
      orderBy: { produit: { nom: 'asc' } },
    });
    res.json(list);
  } catch (e) { next(e); }
});

// GET /api/prix-client/resolve?clientId=X&produitId=Y — Résoudre le prix effectif pour un couple client+produit
router.get('/resolve', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(String(req.query.clientId));
    const produitId = parseInt(String(req.query.produitId));

    if (!clientId || !produitId) {
      res.status(400).json({ error: 'clientId et produitId requis' });
      return;
    }

    const prixClient = await prisma.prixClient.findUnique({
      where: { clientId_produitId: { clientId, produitId } },
    });

    const produit = await prisma.produit.findUnique({
      where: { id: produitId },
      select: { prixUnitaire: true },
    });

    if (!produit) {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }

    res.json({
      prix: prixClient ? Number(prixClient.prix) : Number(produit.prixUnitaire),
      isSpecifique: !!prixClient,
      prixClientId: prixClient?.id ?? null,
    });
  } catch (e) { next(e); }
});

// POST /api/prix-client — Créer ou mettre à jour (upsert) un prix spécifique
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, produitId, prix } = req.body;

    if (!clientId || !produitId || prix === undefined || Number(prix) < 0) {
      res.status(400).json({ error: 'clientId, produitId et prix (≥ 0) sont requis' });
      return;
    }

    const result = await prisma.prixClient.upsert({
      where: { clientId_produitId: { clientId: Number(clientId), produitId: Number(produitId) } },
      update: { prix: Number(prix) },
      create: { clientId: Number(clientId), produitId: Number(produitId), prix: Number(prix) },
      include: {
        client: { select: { id: true, nom: true } },
        produit: { select: { id: true, nom: true, reference: true } },
      },
    });

    await createLog({
      action: 'UPDATE',
      entity: 'PrixClient',
      entityId: result.id,
      description: `Prix spécifique: ${result.produit.nom} → Client ${result.client.nom} = ${prix} DH/kg`,
      userId: (req as any).user?.userId,
    });

    res.status(201).json(result);
  } catch (e) { next(e); }
});

// DELETE /api/prix-client/:id — Supprimer un prix spécifique
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const existing = await prisma.prixClient.findUnique({
      where: { id },
      include: { client: true, produit: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Prix spécifique non trouvé' });
      return;
    }

    await prisma.prixClient.delete({ where: { id } });

    await createLog({
      action: 'DELETE',
      entity: 'PrixClient',
      entityId: id,
      description: `Prix spécifique supprimé: ${existing.produit.nom} → Client ${existing.client.nom}`,
      userId: (req as any).user?.userId,
    });

    res.status(204).send();
  } catch (e: any) {
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Prix spécifique non trouvé' });
      return;
    }
    next(e);
  }
});

export default router;
