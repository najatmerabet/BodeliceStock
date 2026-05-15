import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

async function generateReference(): Promise<string> {
  const all = await prisma.produit.findMany({ select: { reference: true }, orderBy: { reference: 'asc' } });
  const usedNums = new Set(
    all.map(p => parseInt(p.reference.replace('PRD-', ''), 10)).filter(n => !isNaN(n))
  );
  let num = 1;
  while (usedNums.has(num)) num++;
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
            quantite: parseFloat(String(row.quantite || 0)),
          },
          create: {
            reference: ref,
            nom: String(row.nom),
            unite: String(row.unite || 'kg'),
            poidsUnitaire: parseFloat(String(row.poidsUnitaire || 1)),
            quantite: parseFloat(String(row.quantite || 0)),
            prixUnitaire: parseFloat(String(row.prixUnitaire)),
          }
        });
        await createLog({
          action: 'CREATE',
          entity: 'Produit',
          entityId: produit.id,
          description: `Produit créé: ${produit.nom}`,
          userId: (req as any).user?.userId,
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
    const { nom, prixUnitaire, unite, poidsUnitaire, quantite, reference, tva } = req.body;
    if (!nom || prixUnitaire === undefined) { res.status(400).json({ error: 'nom et prixUnitaire sont obligatoires' }); return; }
    const ref = reference || await generateReference();
    const produit = await prisma.produit.create({
      data: {
        reference: ref, nom,
        unite: unite || 'kg',
        poidsUnitaire: poidsUnitaire || 1,
        quantite: quantite || 0,
        prixUnitaire,
        tva: tva !== undefined ? Number(tva) : 0,
      },
    });
    await createLog({
      action: 'CREATE',
      entity: 'Produit',
      entityId: produit.id,
      description: `Produit créé: ${produit.nom}`,
      userId: (req as any).user?.userId,
    });
    res.status(201).json(produit);
  } catch (error: any) {
    next(error);
  }
});

// PUT /api/produits/:id
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const { nom, prixUnitaire, unite, poidsUnitaire, quantite, reference, tva } = req.body;

    // Récupérer l'ancien produit pour comparer la quantité
    const ancien = await prisma.produit.findUnique({ where: { id } });
    if (!ancien) { res.status(404).json({ error: 'Produit non trouvé' }); return; }

    const data: any = {};
    if (nom !== undefined) data.nom = nom;
    if (prixUnitaire !== undefined) data.prixUnitaire = prixUnitaire;
    if (unite !== undefined) data.unite = unite;
    if (poidsUnitaire !== undefined) data.poidsUnitaire = poidsUnitaire;
    if (quantite !== undefined) data.quantite = quantite;
    if (reference !== undefined) data.reference = reference;
    if (tva !== undefined) data.tva = Number(tva);

    const produit = await prisma.$transaction(async (tx) => {
      const updated = await tx.produit.update({ where: { id }, data });

      // Si la quantité a changé, enregistrer le mouvement
      if (quantite !== undefined && Number(quantite) !== Number(ancien.quantite)) {
        const ancienneQte = Number(ancien.quantite);
        const nouvelleQte = Number(quantite);
        const delta = nouvelleQte - ancienneQte;
        await tx.stockMouvement.create({
          data: {
            produitId: id,
            type: delta > 0 ? 'ENTREE' : 'AJUSTEMENT',
            ancienneQte,
            nouvelleQte,
            delta,
            motif: `Modification manuelle (${delta > 0 ? '+' : ''}${delta} ${ancien.unite}s)`,
          },
        });
      }

      return updated;
    });

    await createLog({
      action: 'UPDATE',
      entity: 'Produit',
      entityId: produit.id,
      description: `Produit mis à jour: ${produit.nom}`,
      userId: (req as any).user?.userId,
    });

    res.json(produit);
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Produit non trouvé' }); return; }
    next(error);
  }
});

// GET /api/produits/:id/mouvements — Historique des mouvements de stock
router.get('/:id/mouvements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const mouvements = await prisma.stockMouvement.findMany({
      where: { produitId: id },
      orderBy: { date: 'desc' },
      take: 50,
    });
    res.json(mouvements);
  } catch (error) { next(error); }
});

// DELETE /api/produits/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.produit.delete({ where: { id: parseInt(String(req.params.id)) } });
      await createLog({
      action: 'DELETE',
      entity: 'Produit',
      entityId: parseInt(String(req.params.id)),
      description: `Produit supprimé: ${req.params.id}`,
      userId: (req as any).user?.userId,
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Produit non trouvé' }); return; }
    next(error);
  }
});

export default router;
