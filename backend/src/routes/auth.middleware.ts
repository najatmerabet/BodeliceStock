import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string; // Assurez-vous que cette variable d'environnement est définie

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
};