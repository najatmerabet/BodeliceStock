import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';
const router = Router();

// GET /api/clients — Liste tous les clients
router.get('/', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  try {
    const clients = await prisma.client.findMany({
      orderBy: { nom: 'asc' },
      include: { porteur: true },
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
        porteur: true,
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
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  console.log("🔴 ROUTE POST CLIENTS ATTEINTE");
  console.log("req.user:", (req as any).user);
  console.log("body:", req.body);
  try{
    const lastClient = await prisma.client.findFirst({
      orderBy: { id: 'desc' },
      select: { reference: true }
    });
    
    let newRef = 'CLI-001';
    if (lastClient?.reference) {
      const num = parseInt(lastClient.reference.replace('CLI-', '')) || 0;
      newRef = `CLI-${String(num + 1).padStart(3, '0')}`;
    }

    const { nom, ice, telephone, adresse, email, ville, codepostal, porteurId, commissionRate } = req.body;
    const client = await prisma.client.create({
      data: { 
        reference: newRef, 
        nom, 
        ice, 
        telephone, 
        adresse, 
        email, 
        ville, 
        codepostal,
        porteurId: porteurId ? parseInt(String(porteurId)) : null,
        commissionRate: (commissionRate !== undefined && commissionRate !== null) ? parseFloat(String(commissionRate)) : null,
      },
    });
    try{
    await createLog({
      action: 'CREATE',
      entity: 'Client',
      entityId: client.id,
      description: `Client créé: ${client.nom}`,
      userId: (req as any).user?.userId,
    })}catch(logError){
      console.error("Erreur lors de la création du log:", logError);
    }
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: 'Erreur lors de la création du client', details: (error as any).message });
  }
});
// PUT /api/clients/:id — Modifier un client
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("🟢 PUT client route hit", req.params.id, req.body);
    const { reference, nom, ice, telephone, adresse, email, ville, codepostal, porteurId, commissionRate } = req.body;
    const clientId = parseInt(String(req.params.id));
    console.log("🟢 Parsing client ID:", clientId);
    
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { 
        reference: reference || null, 
        nom, 
        ice, 
        telephone, 
        adresse, 
        email, 
        ville, 
        codepostal,
        porteurId: porteurId ? parseInt(String(porteurId)) : null,
        commissionRate: (commissionRate !== undefined && commissionRate !== null) ? parseFloat(String(commissionRate)) : null,
      },
    });
    console.log("🟢 Client updated:", client.id);
    
    if ((req as any).user?.userId) {
      await createLog({
        action: 'UPDATE',
        entity: 'Client',
        entityId: client.id,
        description: `Client mis à jour: ${client.nom}`,
        userId: (req as any).user.userId,
      }).catch(e => console.error('Log error:', e));
    }
    
    res.json(client);
  } catch (error: any) {
    console.error('🔴 PUT client error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Client non trouvé' });
      return;
    }
    res.status(500).json({ error: 'Erreur: ' + error.message });
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
      userId: (req as any).user?.userId,
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
