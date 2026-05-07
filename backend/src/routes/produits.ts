import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import * as xlsx from 'xlsx';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/produits/import — Importer depuis Excel
router.post('/import', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier uploadé' });
      return;
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    const results = [];
    for (const row of data as any[]) {
      if (row.nom && row.prix !== undefined) {
        const produit = await prisma.produit.upsert({
          where: { nom: String(row.nom) },
          update: {
            prix: parseFloat(String(row.prix)),
            stock: parseFloat(String(row.stock || 0))
          },
          create: {
            nom: String(row.nom),
            prix: parseFloat(String(row.prix)),
            stock: parseFloat(String(row.stock || 0))
          }
        });
        results.push(produit);
      }
    }

    res.json({ message: `${results.length} produits importés/mis à jour`, count: results.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/produits — Liste tous les produits
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const produits = await prisma.produit.findMany({
      orderBy: { nom: 'asc' },
    });
    res.json(produits);
  } catch (error) {
    next(error);
  }
});

// GET /api/produits/:id — Un seul produit
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const produit = await prisma.produit.findUnique({
      where: { id: parseInt(String(req.params.id)) },
    });
    if (!produit) {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }
    res.json(produit);
  } catch (error) {
    next(error);
  }
});

// POST /api/produits — Créer un produit
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, prix, stock } = req.body;
    if (!nom || prix === undefined) {
      res.status(400).json({ error: 'nom et prix sont obligatoires' });
      return;
    }
    const produit = await prisma.produit.create({
      data: { nom, prix, stock: stock || 0 },
    });
    res.status(201).json(produit);
  } catch (error) {
    next(error);
  }
});

// PUT /api/produits/:id — Modifier un produit
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, prix, stock } = req.body;
    const produit = await prisma.produit.update({
      where: { id: parseInt(String(req.params.id)) },
      data: { nom, prix, stock },
    });
    res.json(produit);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }
    next(error);
  }
});

// DELETE /api/produits/:id — Supprimer un produit
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.produit.delete({
      where: { id: parseInt(String(req.params.id)) },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Produit non trouvé' });
      return;
    }
    next(error);
  }
});

export default router;
