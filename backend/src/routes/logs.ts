import { Router } from "express";
import { authMiddleware} from "./auth.middleware";
import prisma from "../prisma";


const router = Router();

// GET /api/logs — Liste tous les logs
router.get('/', authMiddleware, async (req, res, next) => {
    const { userId, action, entity, startDate, endDate } = req.query;
     
    const logs = await prisma.activityLog.findMany({
        where: {
            userId : userId ? Number(userId) : undefined,
            action: action ? String(action) : undefined,
            entity: entity ? String(entity) : undefined,
            createdAt: {
                gte: startDate ? new Date(String(startDate)) : undefined,
                lte: endDate ? new Date(String(endDate)) : undefined,
            }
        },
        include:{
            user : true,
        },
        orderBy: {createdAt: 'desc'},
    });
    res.json(logs);
    }
    
)

router.get('/:id', authMiddleware, async (req, res, next) => {
    const log = await prisma.activityLog.findUnique({
        where: { id: Number(req.params.id) },
        include: {
            user: true,
        }
    });
    res.json(log);
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
    await prisma.activityLog.delete({
        where: { id: Number(req.params.id) },
    });
    res.status(204).send();
});

export default router;