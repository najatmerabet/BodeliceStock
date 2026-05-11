import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

// Génère le prochain numéro facture : FA-0001, FA-0002...
async function generateNumeroFacture(): Promise<string> {
  const last = await prisma.facture.findFirst({
    orderBy: { id: 'desc' },
  });
  const nextNum = last ? last.id + 1 : 1;
  return `FA-${String(nextNum).padStart(4, '0')}`;
}

// GET /api/factures — Liste toutes les factures
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const factures = await prisma.facture.findMany({
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    res.json(factures);
  } catch (error) {
    next(error);
  }
});

// GET /api/factures/:id — Une facture
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facture = await prisma.facture.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: { client: true },
    });
    if (!facture) {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }
    res.json(facture);
  } catch (error) {
    next(error);
  }
});

// POST /api/factures — Créer une facture
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, total, paye } = req.body;
    if (!clientId || total === undefined) {
      res.status(400).json({ error: 'clientId et total sont obligatoires' });
      return;
    }

    const numero = await generateNumeroFacture();
    const payeAmount = paye || 0;
    const reste = total - payeAmount;
    const statut = reste <= 0 ? 'payée' : 'impayée';

    const facture = await prisma.facture.create({
      data: {
        numero,
        clientId,
        total,
        paye: payeAmount,
        reste: Math.max(0, reste),
        statut,
      },
      include: { client: true },
    });
    res.status(201).json(facture);
  } catch (error) {
    next(error);
  }
});

// PUT /api/factures/:id/payer — Ajouter un paiement
router.put('/:id/payer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { montant } = req.body;
    if (!montant || montant <= 0) {
      res.status(400).json({ error: 'montant doit être supérieur à 0' });
      return;
    }

    const facture = await prisma.facture.findUnique({
      where: { id: parseInt(String(req.params.id)) },
    });
    if (!facture) {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }

    if (facture.statut === 'payée') {
      res.status(400).json({ error: 'Cette facture est déjà payée' });
      return;
    }

    const newPaye = Number(facture.paye) + Number(montant);
    const newReste = Number(facture.total) - newPaye;
    const newStatut = newReste <= 0 ? 'payée' : 'impayée';

    const updated = await prisma.facture.update({
      where: { id: parseInt(String(req.params.id)) },
      data: {
        paye: newPaye,
        reste: Math.max(0, newReste),
        statut: newStatut,
      },
      include: { client: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/factures/:id — Supprimer une facture
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.facture.delete({
      where: { id: parseInt(String(req.params.id)) },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Facture non trouvée' });
      return;
    }
    next(error);
  }
});

const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const endOfMonth = new Date();
endOfMonth.setMonth(endOfMonth.getMonth() + 1);
endOfMonth.setDate(0);

const revenusMensuel = prisma.facture.aggregate({
  _sum: {
    total: true
  },
  where: {
    date: {
      gte: startOfMonth,
      lte: endOfMonth
    }
  }
});

export default router;
