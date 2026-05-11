import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

// Middleware d'erreur centralisé — à monter en dernier dans index.ts
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode || 500;
  const message = err.message || 'Erreur serveur interne';
  console.error(`[ERROR] ${status} — ${message}`);
  console.error(err); // Log full error object for debugging
  res.status(status).json({ error: message });
}

// Crée une erreur avec un code HTTP
export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
