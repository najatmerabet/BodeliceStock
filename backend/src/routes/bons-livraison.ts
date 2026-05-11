import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

async function generateNumeroBL(): Promise<string> {
  const last = await prisma.bonLivraison.findFirst({ orderBy: { id: 'desc' } });
  const nextId = last ? last.id + 1 : 1;
  return `BL-${String(nextId).padStart(4, '0')}`;
}

// GET / — Liste tous les BLs
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bls = await prisma.bonLivraison.findMany({
      include: { client: true, lignes: { include: { produit: true } } },
      orderBy: { date: 'desc' },
    });
    res.json(bls);
  } catch (error) { next(error); }
});

// GET /:id — Un BL avec ses lignes
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bl = await prisma.bonLivraison.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { client: true, lignes: { include: { produit: true } } },
    });
    if (!bl) { res.status(404).json({ error: 'Bon de livraison non trouvé' }); return; }
    res.json(bl);
  } catch (error) { next(error); }
});

// POST / — Créer un BL avec ses lignes + déduction stock
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, lignes } = req.body;
    console.log('Creating BL for client:', clientId, 'with lignes:', lignes);

    if (!clientId || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'clientId et lignes[] sont obligatoires' });
    }

    // Validation des données
    for (const l of lignes) {
      const q = Number(l.quantite);
      const p = Number(l.prix);
      if (isNaN(q) || q <= 0) {
        return res.status(400).json({ error: `Quantité invalide pour le produit ${l.produitId}` });
      }
      if (isNaN(p) || p < 0) {
        return res.status(400).json({ error: `Prix invalide pour le produit ${l.produitId}` });
      }
    }

    // Vérification stock
    for (const l of lignes) {
      const produit = await prisma.produit.findUnique({ where: { id: Number(l.produitId) } });
      if (!produit) {
        return res.status(400).json({ error: `Produit id=${l.produitId} non trouvé` });
      }
      const unitsNeeded = Number(l.nbUnites || 1);
      if (Number(produit.quantite) < unitsNeeded) {
        return res.status(400).json({
          error: `Stock insuffisant pour "${produit.nom}" — dispo: ${produit.quantite} ${produit.unite}s, demandé: ${unitsNeeded}`,
        });
      }
    }

    const numero = await generateNumeroBL();

    let totalBL = 0;
    const lignesData = lignes.map((l: any) => {
      const n = Number(l.nbUnites || 1);
      const pu = Number(l.poidsUnitaire || l.quantite || 1);
      const q = n * pu; // Poids total
      const pr = Number(l.prix);
      const totalLigne = q * pr;
      totalBL += totalLigne;
      return { 
        produitId: Number(l.produitId), 
        nbUnites: n,
        poidsUnitaire: pu,
        quantite: q, 
        prix: pr, 
        total: totalLigne 
      };
    });

    const bl = await prisma.$transaction(async (tx) => {
      // 1. Créer le BL
      const newBl = await tx.bonLivraison.create({
        data: {
          numero, 
          clientId: Number(clientId), 
          total: totalBL,
          lignes: { create: lignesData },
        },
        include: { client: true, lignes: { include: { produit: true } } },
      });

      // 2. Déduire le stock
      for (const l of lignesData) {
        const prod = await tx.produit.findUnique({ where: { id: l.produitId } });
        const ancienneQte = Number(prod?.quantite || 0);
        const nouvelleQte = ancienneQte - l.nbUnites;

        await tx.produit.update({
          where: { id: l.produitId },
          data: { quantite: nouvelleQte },
        });

        await tx.stockMouvement.create({
          data: {
            produitId: l.produitId,
            type: 'BL_CREATION',
            ancienneQte,
            nouvelleQte,
            delta: -l.nbUnites,
            motif: `Sortie BL ${newBl.numero} (${l.nbUnites} ${prod?.unite}s)`,
          },
        });
      }

      return newBl;
    });

    res.status(201).json(bl);
  } catch (error) { next(error); }
});

// PUT /:id — Modifier un BL (client + lignes + ajustement stock)
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const { clientId, lignes } = req.body;

    if (!clientId || !Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ error: 'clientId et lignes[] sont obligatoires' });
    }

    const existingBl = await prisma.bonLivraison.findUnique({
      where: { id },
      include: { lignes: true },
    });
    if (!existingBl) { res.status(404).json({ error: 'BL non trouvé' }); return; }

    if ((existingBl as any).factureId) {
      return res.status(400).json({ error: 'Impossible de modifier un BL déjà facturé' });
    }

    // Validation
    for (const l of lignes) {
      const q = Number(l.quantite);
      const p = Number(l.prix);
      if (isNaN(q) || q <= 0) return res.status(400).json({ error: `Quantité invalide pour produit ${l.produitId}` });
      if (isNaN(p) || p < 0) return res.status(400).json({ error: `Prix invalide pour produit ${l.produitId}` });
    }

    // Préparer les nouvelles lignes
    let totalBL = 0;
    const lignesData = lignes.map((l: any) => {
      const n = Number(l.nbUnites || 1);
      const pu = Number(l.poidsUnitaire || l.quantite || 1);
      const q = n * pu;
      const pr = Number(l.prix);
      const totalLigne = q * pr;
      totalBL += totalLigne;
      return { produitId: Number(l.produitId), nbUnites: n, poidsUnitaire: pu, quantite: q, prix: pr, total: totalLigne };
    });

    // Vérifier stock (restaurer ancien d'abord virtuellement)
    const stockMap = new Map<number, number>();
    for (const ol of existingBl.lignes) {
      stockMap.set(ol.produitId, (stockMap.get(ol.produitId) || 0) + Number(ol.nbUnites));
    }
    for (const nl of lignesData) {
      const produit = await prisma.produit.findUnique({ where: { id: nl.produitId } });
      if (!produit) return res.status(400).json({ error: `Produit id=${nl.produitId} non trouvé` });
      const currentStock = Number(produit.quantite) + (stockMap.get(nl.produitId) || 0);
      if (currentStock < nl.nbUnites) {
        return res.status(400).json({ error: `Stock insuffisant pour "${produit.nom}" — dispo: ${currentStock}, demandé: ${nl.nbUnites}` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Restaurer ancien stock
      for (const ol of existingBl.lignes) {
        await tx.produit.update({
          where: { id: ol.produitId },
          data: { quantite: { increment: Number(ol.nbUnites) } },
        });
      }

      // 2. Supprimer anciennes lignes
      await tx.ligneBl.deleteMany({ where: { blId: id } });

      // 3. Mettre à jour le BL
      const bl = await tx.bonLivraison.update({
        where: { id },
        data: {
          clientId: Number(clientId),
          total: totalBL,
          lignes: { create: lignesData },
        },
        include: { client: true, lignes: { include: { produit: true } } },
      });

      // 4. Déduire le nouveau stock
      for (const nl of lignesData) {
        await tx.produit.update({
          where: { id: nl.produitId },
          data: { quantite: { decrement: nl.nbUnites } },
        });
      }

      return bl;
    });

    res.json(updated);
  } catch (error) { next(error); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const bl = await prisma.bonLivraison.findUnique({
      where: { id },
      include: { lignes: true },
    });
    if (!bl) { res.status(404).json({ error: 'BL non trouvé' }); return; }

    // Restaurer stock et supprimer BL dans une transaction
    await prisma.$transaction(async (tx) => {
      for (const ligne of bl.lignes) {
        const prod = await tx.produit.findUnique({ where: { id: ligne.produitId } });
        const ancienneQte = Number(prod?.quantite || 0);
        const nb = Number(ligne.nbUnites || 0);
        const nouvelleQte = ancienneQte + nb;

        await tx.produit.update({
          where: { id: ligne.produitId },
          data: { quantite: nouvelleQte },
        });

        await tx.stockMouvement.create({
          data: {
            produitId: ligne.produitId,
            type: 'BL_SUPPRESSION',
            ancienneQte,
            nouvelleQte,
            delta: nb,
            motif: `Restauration (Suppression BL ${bl.numero})`,
          },
        });
      }
      await tx.bonLivraison.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
