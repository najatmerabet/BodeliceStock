import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRouter from './routes/auth';
import logs from './routes/logs';
import produitsRouter from './routes/produits';
import clientsRouter from './routes/clients';
import blRouter from './routes/bons-livraison';
import facturesRouter from './routes/factures';
import proformasRouter from './routes/proformas';
import avoirsRouter from './routes/avoirs';
import dashboardRouter from './routes/dashboard';
import { errorHandler } from './middleware/errorHandler';
import statisticsRouter from './routes/statistics';
import prixClientRouter from './routes/prix-client';
import clientsFilesRouter from './routes/clients-files';
import clientsFoldersRouter from './routes/clients-folders';
import stockUsineRouter from './routes/stock-usine';
import productionRouter from './routes/production';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/produits', produitsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/bons-livraison', blRouter);
app.use('/api/factures', facturesRouter);
app.use('/api/dashboard', statisticsRouter);
app.use('/api/auth', authRouter);
app.use('/api/proformas', proformasRouter);
app.use('/api/avoirs', avoirsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/logs', logs);
app.use('/api/prix-client', prixClientRouter);
app.use('/api/clients/fichiers', clientsFilesRouter);
app.use('/api/clients/folders', clientsFoldersRouter);
app.use('/api/stock-usine', stockUsineRouter);
app.use('/api/production', productionRouter);
// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '🏭 ProdMeat Stock API is running' });
});

// Error handler — TOUJOURS en dernier
app.use(errorHandler);

// Start
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});

export default app;
