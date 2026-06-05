import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  const JWT_SECRET = process.env.JWT_SECRET || 'prodmeatstocksecret2024';

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log("Decoded Token:", decoded);
    const userId = decoded.userId ?? decoded.id;

    if (!userId) {
      return res.status(401).json({ error: 'Token invalide: userId manquant' });
    }

    (req as any).user = { userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};