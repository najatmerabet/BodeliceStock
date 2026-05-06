import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/clients — Liste tous les clients
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
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
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, telephone, adresse } = req.body;
    if (!nom) {
      res.status(400).json({ error: 'nom est obligatoire' });
      return;
    }
    const client = await prisma.client.create({
      data: { nom, telephone, adresse },
    });
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

// PUT /api/clients/:id — Modifier un client
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, telephone, adresse } = req.body;
    const client = await prisma.client.update({
      where: { id: parseInt(String(req.params.id)) },
      data: { nom, telephone, adresse },
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
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.client.delete({
      where: { id: parseInt(String(req.params.id)) },
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
