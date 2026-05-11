import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';
const router = Router();

// GET /api/clients — Liste tous les clients
router.get('/', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { nom: 'asc' },
    });
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id — Un seul client avec ses BLs et factures
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        bonsLivraison: { orderBy: { date: 'desc' }, take: 10 },
        factures: { orderBy: { date: 'desc' }, take: 10 },
      },
    });
    if (!client) {
      res.status(404).json({ error: 'Client non trouvé' });
      return;
    }
    res.json(client);
  } catch (error) {
    next(error);
  }
});

// POST /api/clients — Créer un client
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, ice, telephone, adresse, email, ville, codepostal } = req.body;
    if (!nom) {
      res.status(400).json({ error: 'nom est obligatoire' });
      return;
    }
    const client = await prisma.client.create({
      data: { nom, ice, telephone, adresse, email, ville, codepostal },
    });
    await createLog({
      action: 'CREATE',
      entity: 'Client',
      entityId: client.id,
      description: `Client créé: ${client.nom}`,
      userId: (req as any).user.id,
    });
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

// PUT /api/clients/:id — Modifier un client
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, ice, telephone, adresse, email, ville, codepostal } = req.body;
    const client = await prisma.client.update({
      where: { id: parseInt(String(req.params.id)) },
      data: { nom, ice, telephone, adresse, email, ville, codepostal },
    });
    await createLog({
      action: 'UPDATE',
      entity: 'Client',
      entityId: client.id,
      description: `Client mis à jour: ${client.nom}`,
      userId: (req as any).user.id,
    });
    res.json(client);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Client non trouvé' });
      return;
    }
    next(error);
  }
});

// DELETE /api/clients/:id — Supprimer un client
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.client.delete({
      where: { id: parseInt(String(req.params.id)) },
    });
    await createLog({
      action: 'DELETE',
      entity: 'Client',
      entityId: parseInt(String(req.params.id)),
      description: `Client supprimé: ${req.params.id}`,
      userId: (req as any).user.id,
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Client non trouvé' });
      return;
    }
    next(error);
  }
});

export default router;
