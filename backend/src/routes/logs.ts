import { Router } from "express";
import { authMiddleware} from "./auth.middleware";
import prisma from "../prisma";


const router = Router();

// GET /api/logs — Liste tous les logs avec pagination
router.get('/', authMiddleware, async (req, res, next) => {
    const { userId, action, entity, startDate, endDate, page, pageSize } = req.query;
    
    const pageNum = Number(page) || 1;
    const size = Number(pageSize) || 20;
    const skip = (pageNum - 1) * size;
    
    const where: any = {};
    
    if (userId) where.userId = Number(userId);
    if (action) where.action = String(action);
    if (entity) where.entity = String(entity);
    
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(String(startDate));
        if (endDate) {
            const end = new Date(String(endDate));
            end.setHours(23, 59, 59, 999);
            where.createdAt.lte = end;
        }
    }
    
    try {
        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                include: {
                    user: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: size,
            }),
            prisma.activityLog.count({ where }),
        ]);
        
        res.json({
            data: logs,
            total,
            page: pageNum,
            pageSize: size,
            totalPages: Math.ceil(total / size),
        });
    } catch (error) {
        next(error);
    }
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