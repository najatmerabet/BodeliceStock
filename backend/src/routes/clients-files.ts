import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir= `uploads/clients/${req.params.clientId}`;
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
    limits : { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => { const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Type de fichier non autorisé'));
    }
})


router.get('/:clientId/fichiers', async (req: Request, res: Response) => {
  try {
    const fichiers = await prisma.clientfile.findMany({
      where: { clientId: Number(req.params.clientId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(fichiers);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:clientId/fichiers', upload.single('fichier'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

    const fichier = await prisma.clientfile.create({
      data: {
        clientId:   Number(req.params.clientId),
        nom:        req.body.nom || req.file.originalname,
        nomFichier: req.file.originalname,
        chemin:     req.file.path,
        type:       req.body.type || 'AUTRE',
       
      }
    });
    res.status(201).json(fichier);
  } catch (err) {
    res.status(500).json({ error: 'Erreur upload' });
  }
});

router.patch('/:clientId/fichiers/:id', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.update({
      where: { id: Number(req.params.id) },
      data: {
        nom:      req.body.nom,
        type:     req.body.type,
        remarque: req.body.remarque
      }
    });
    res.json(fichier);
  } catch (err) {
    res.status(500).json({ error: 'Erreur modification' });
  }
});

router.delete('/:clientId/fichiers/:id', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!fichier) return res.status(404).json({ error: 'Fichier introuvable' });

    // Supprimer le fichier physique
    if (fs.existsSync(fichier.chemin)) fs.unlinkSync(fichier.chemin);

    await prisma.clientfile.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Fichier supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

router.get('/:clientId/fichiers/:id/download', async (req: Request, res: Response) => {
  try {
    const fichier = await prisma.clientfile.findUnique({
      where: { id: Number(req.params.id) }
    });
    if (!fichier || !fs.existsSync(fichier.chemin)) {
      return res.status(404).json({ error: 'Fichier introuvable' });
    }
    res.download(fichier.chemin, fichier.nomFichier);
  } catch (err) {
    res.status(500).json({ error: 'Erreur téléchargement' });
  }
});

export default router;

