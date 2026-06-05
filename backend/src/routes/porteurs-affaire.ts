import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { authMiddleware } from './auth.middleware';
import { createLog } from '../services/log.service';

const router = Router();

// GET /api/porteurs-affaire - List all porteurs
router.get('/', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const porteurs = await prisma.porteurAffaire.findMany({
      include: {
        clients: true,
      },
      orderBy: { nom: 'asc' },
    });
    res.json(porteurs);
  } catch (error) {
    next(error);
  }
});

// GET /api/porteurs-affaire/categories - List all unique product categories
router.get('/categories', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = await prisma.produit.findMany({
      select: { categorie: true },
      distinct: ['categorie'],
    });
    const categories = raw.map(p => p.categorie).filter(Boolean) as string[];
    
    // Check if any product has no category
    const hasNoCategory = await prisma.produit.findFirst({
      where: {
        OR: [
          { categorie: null },
          { categorie: '' }
        ]
      }
    });
    if (hasNoCategory) {
      categories.push('Sans Catégorie');
    }
    
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/porteurs-affaire/clients/:clientId/commissions - Get commissions for a client
router.get('/clients/:clientId/commissions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(String(req.params.clientId));
    const commissions = await prisma.clientCategoryCommission.findMany({
      where: { clientId },
    });
    res.json(commissions);
  } catch (error) {
    next(error);
  }
});

// PUT /api/porteurs-affaire/clients/:clientId/commissions - Save commissions in bulk
router.put('/clients/:clientId/commissions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = parseInt(String(req.params.clientId));
    const commissionsData = req.body; // Array of { categorie: string, commission: number }

    if (!Array.isArray(commissionsData)) {
      res.status(400).json({ error: "Format invalide, un tableau est attendu" });
      return;
    }

    await prisma.$transaction([
      prisma.clientCategoryCommission.deleteMany({
        where: { clientId }
      }),
      prisma.clientCategoryCommission.createMany({
        data: commissionsData.map(c => ({
          clientId,
          categorie: c.categorie,
          commission: parseFloat(String(c.commission || 0))
        }))
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/porteurs-affaire/:id - Single porteur
router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const porteur = await prisma.porteurAffaire.findUnique({
      where: { id },
      include: {
        clients: true,
      },
    });
    if (!porteur) {
      res.status(404).json({ error: "Porteur d'affaires non trouvé" });
      return;
    }
    res.json(porteur);
  } catch (error) {
    next(error);
  }
});

// POST /api/porteurs-affaire - Create porteur
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nom, telephone, email } = req.body;
    if (!nom) {
      res.status(400).json({ error: "Le nom est obligatoire" });
      return;
    }
    const porteur = await prisma.porteurAffaire.create({
      data: { nom, telephone, email },
    });

    await createLog({
      action: 'CREATE',
      entity: 'PorteurAffaire',
      entityId: porteur.id,
      description: `Porteur d'affaires créé: ${porteur.nom}`,
      userId: (req as any).user?.userId,
    }).catch(e => console.error('Log error:', e));

    res.status(201).json(porteur);
  } catch (error) {
    next(error);
  }
});

// PUT /api/porteurs-affaire/:id - Update porteur
router.put('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const { nom, telephone, email } = req.body;
    if (!nom) {
      res.status(400).json({ error: "Le nom est obligatoire" });
      return;
    }
    const porteur = await prisma.porteurAffaire.update({
      where: { id },
      data: { nom, telephone, email },
    });

    await createLog({
      action: 'UPDATE',
      entity: 'PorteurAffaire',
      entityId: porteur.id,
      description: `Porteur d'affaires mis à jour: ${porteur.nom}`,
      userId: (req as any).user?.userId,
    }).catch(e => console.error('Log error:', e));

    res.json(porteur);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/porteurs-affaire/:id - Delete porteur
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    
    // Dissociate clients associated with this porteur first
    await prisma.client.updateMany({
      where: { porteurId: id },
      data: { porteurId: null, commissionRate: null }
    });

    await prisma.porteurAffaire.delete({
      where: { id },
    });

    await createLog({
      action: 'DELETE',
      entity: 'PorteurAffaire',
      entityId: id,
      description: `Porteur d'affaires supprimé id: ${id}`,
      userId: (req as any).user?.userId,
    }).catch(e => console.error('Log error:', e));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/porteurs-affaire/:id/rapport - Fetch commission report
router.get('/:id/rapport', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id));
    const { mois } = req.query; // YYYY-MM

    const porteur = await prisma.porteurAffaire.findUnique({
      where: { id }
    });

    if (!porteur) {
      res.status(404).json({ error: "Porteur d'affaires non trouvé" });
      return;
    }

    const clients = await prisma.client.findMany({
      where: { porteurId: id }
    });

    if (clients.length === 0) {
      res.json({
        lines: [],
        totaux: {
          totalRestaurant: 0,
          totalPorteur: 0,
          totalAvoir: 0
        }
      });
      return;
    }

    const clientIds = clients.map(c => c.id);

    let dateFilter: any = {};
    if (mois && String(mois).match(/^\d{4}-\d{2}$/)) {
      const [year, month] = String(mois).split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = {
        gte: startOfMonth,
        lte: endOfMonth
      };
    }

    const bls = await prisma.bonLivraison.findMany({
      where: {
        clientId: { in: clientIds },
        ...(mois ? { date: dateFilter } : {})
      },
      include: {
        client: true,
        lignes: {
          include: {
            produit: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Fetch all category-specific commissions for these clients
    const categoryCommissions = await prisma.clientCategoryCommission.findMany({
      where: {
        clientId: { in: clientIds }
      }
    });

    // Create a lookup map: "clientId_category" -> commissionAmount
    const commissionMap = new Map<string, number>();
    categoryCommissions.forEach(cc => {
      const key = `${cc.clientId}_${cc.categorie.toLowerCase().trim()}`;
      commissionMap.set(key, Number(cc.commission));
    });

    const lines: any[] = [];
    let totalRestaurant = 0;
    let totalPorteur = 0;
    let totalAvoir = 0;

    for (const bl of bls) {
      for (const l of bl.lignes) {
        const productCategory = (l.produit.categorie || 'Sans Catégorie').toLowerCase().trim();
        const key = `${bl.client.id}_${productCategory}`;
        const commissionAmount = commissionMap.get(key) || 0;

        const prixRestaurant = Number(l.prix);
        const poids = Number(l.quantite); // quantite field in DB represents total weight
        const nbUnites = Number(l.nbUnites || 0);
        const montant = Number(l.total || poids * prixRestaurant);
        
        const prixPorteur = prixRestaurant - commissionAmount;
        const totalLinePorteur = poids * prixPorteur;
        const avoir = poids * commissionAmount;

        totalRestaurant += montant;
        totalPorteur += totalLinePorteur;
        totalAvoir += avoir;

        lines.push({
          date: bl.date,
          blNumero: bl.numero,
          clientNom: bl.client.nom,
          produitNom: l.produit.nom,
          nbUnites,
          poidsUnitaire: Number(l.poidsUnitaire || 0),
          poids,
          prixRestaurant,
          montant,
          totalFacture: Number(bl.total),
          prixPorteur,
          totalPorteur: totalLinePorteur,
          avoir
        });
      }
    }

    res.json({
      lines,
      totaux: {
        totalRestaurant,
        totalPorteur,
        totalAvoir
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
