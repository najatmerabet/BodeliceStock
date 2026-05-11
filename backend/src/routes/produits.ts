import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { authMiddleware } from './auth.middleware';
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function generateReference(): Promise<string> {
  const last = await prisma.produit.findFirst({ orderBy: { id: 'desc' } });
  const num = last ? last.id + 1 : 1;
  return `PRD-${String(num).padStart(3, '0')}`;
}

// POST /api/produits/import
router.post('/import', authMiddleware, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'Aucun fichier uploadé' }); return; }
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    const results = [];
    for (const row of data as any[]) {
      if (row.nom && row.prixUnitaire !== undefined) {
        const ref = row.reference || await generateReference();
        const produit = await prisma.produit.upsert({
          where: { nom: String(row.nom) },
          update: {
            prixUnitaire: parseFloat(String(row.prixUnitaire)),
            unite: String(row.unite || 'kg'),
            poidsUnitaire: parseFloat(String(row.poidsUnitaire || 1)),
            quantite: parseInt(String(row.quantite || 0)),
          },
          create: {
            reference: ref,
            nom: String(row.nom),
            unite: String(row.unite || 'kg'),
            poidsUnitaire: parseFloat(String(row.poidsUnitaire || 1)),
            quantite: parseInt(String(row.quantite || 0)),
            prixUnitaire: parseFloat(String(row.prixUnitaire)),
          }
        });
        results.push(produit);
      }
    }
    res.json({ message: `${results.length} produits importés/mis à jour`, count: results.length });
  } catch (error) { next(error); }
});

// GET /api/produits
router.get('/', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const produits = await prisma.produit.findMany({ orderBy: { reference: 'asc' } });
    res.json(produits);
  } catch (error) { next(error); }
});

// GET /api/produits/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const produit = await prisma.produit.findUnique({ where: { id: parseInt(String(req.params.id)) } });
    if (!produit) { res.status(404).json({ error: 'Produit non trouvé' }); return; }
    res.json(produit);
  } catch (error) { next(error); }
});

// POST /api/produits
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, prixUnitaire, unite, poidsUnitaire, quantite, reference } = req.body;
    if (!nom || prixUnitaire === undefined) { res.status(400).json({ error: 'nom et prixUnitaire sont obligatoires' }); return; }
    const ref = reference || await generateReference();
    const produit = await prisma.produit.create({
      data: {
        reference: ref, nom,
        unite: unite || 'kg',
        poidsUnitaire: poidsUnitaire || 1,
        quantite: quantite || 0,
        prixUnitaire,
      },
    });
    res.status(201).json(produit);
  } catch (error) { next(error); }
});

// PUT /api/produits/:id
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, prixUnitaire, unite, poidsUnitaire, quantite, reference } = req.body;
    const data: any = {};
    if (nom !== undefined) data.nom = nom;
    if (prixUnitaire !== undefined) data.prixUnitaire = prixUnitaire;
    if (unite !== undefined) data.unite = unite;
    if (poidsUnitaire !== undefined) data.poidsUnitaire = poidsUnitaire;
    if (quantite !== undefined) data.quantite = quantite;
    if (reference !== undefined) data.reference = reference;
    const produit = await prisma.produit.update({
      where: { id: parseInt(String(req.params.id)) }, data
    });
    res.json(produit);
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Produit non trouvé' }); return; }
    next(error);
  }
});

// DELETE /api/produits/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.produit.delete({ where: { id: parseInt(String(req.params.id)) } });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Produit non trouvé' }); return; }
    next(error);
  }
});

export default router;
