import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from './auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/:clientId/folders', async (req: Request, res: Response) => {
  try {
    const folders = await prisma.clientFolder.findMany({
      where: { clientId: Number(req.params.clientId) },
      orderBy: { nom: 'asc' }
    });
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:clientId/folders', async (req: Request, res: Response) => {
  try {
    const { nom, parentId, couleur } = req.body;
    const folder = await prisma.clientFolder.create({
      data: {
        clientId: Number(req.params.clientId),
        nom,
        parentId: parentId || null,
        couleur: couleur || '#6B7280'
      }
    });
    res.status(201).json(folder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:clientId/folders/:id', async (req: Request, res: Response) => {
  try {
    const { nom, couleur } = req.body;
    const folder = await prisma.clientFolder.update({
      where: { id: Number(req.params.id) },
      data: { nom, couleur }
    });
    res.json(folder);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:clientId/folders/:id', async (req: Request, res: Response) => {
  try {
    const folderId = Number(req.params.id);
    const filesInFolder = await prisma.clientfile.findMany({
      where: { folderId }
    });
    
    for (const file of filesInFolder) {
      if (fs.existsSync(file.chemin)) {
        fs.unlinkSync(file.chemin);
      }
    }
    
    await prisma.clientFolder.delete({ where: { id: folderId } });
    res.json({ message: 'Dossier supprimé' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;