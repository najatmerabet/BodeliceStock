import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from './auth.middleware';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const clientId = req.params.clientId;
        const folderId = req.body.folderId;
        let dir = `uploads/clients/${clientId}`;
        if (folderId) {
            dir = `uploads/clients/${clientId}/folders/${folderId}`;
        }
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar'];
        const ext = path.extname(file.originalname).toLowerCase();
        allowed.includes(ext) ? cb(null, true) : cb(new Error('Type de fichier non autorisé'));
    }
});

router.get('/:clientId/files', async (req: Request, res: Response) => {
  try {
    const folderId = req.query.folderId ? Number(req.query.folderId) : null;
    const where: any = { clientId: Number(req.params.clientId) };
    if (folderId !== null) {
      where.folderId = folderId;
    }
    const fichiers = await prisma.clientfile.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(fichiers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:clientId/files', upload.single('fichier'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    
    const fichier = await prisma.clientfile.create({
      data: {
        clientId:   Number(req.params.clientId),
        folderId:   req.body.folderId ? Number(req.body.folderId) : null,
        nom:        req.body.nom || req.file.originalname,
        nomFichier: req.file.originalname,
        chemin:     req.file.path,
        type:       req.body.type || 'AUTRE',
        taille:     req.file.size
      }
    });
    res.status(201).json(fichier);
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:clientId/files/:id', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.update({
      where: { id: Number(req.params.id) },
      data: {
        nom:      req.body.nom,
        type:     req.body.type,
        remarque: req.body.remarque,
        folderId: req.body.folderId !== undefined ? (req.body.folderId ? Number(req.body.folderId) : null) : undefined
      }
    });
    res.json(fichier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:clientId/files/:id', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!fichier) return res.status(404).json({ error: 'Fichier introuvable' });

    if (fs.existsSync(fichier.chemin)) fs.unlinkSync(fichier.chemin);
    await prisma.clientfile.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Fichier supprimé' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:clientId/files/:id/download', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!fichier || !fs.existsSync(fichier.chemin)) {
      return res.status(404).json({ error: 'Fichier introuvable' });
    }
    res.download(fichier.chemin, fichier.nomFichier);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;