/**
 * SW Service Desk v1.0 - Ponto de Entrada do Servidor Full-Stack
 * Organização: SW Cloud Solutions
 */

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './server/routes/api.js';
import { db } from './server/db/connection.js';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // 1. Inicializar base de dados relacional e aplicar migrações/seeds
  console.log('[SW-SERVER] A inicializar base de dados...');
  await db.initialize();

  // 2. Middlewares de Segurança e Parse
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());

  // CORS configurado para cookies seguros
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Rate Limiting para proteção contra ataques de força bruta
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo de 100 pedidos por janela
    message: { error: 'Demasiadas tentativas de autenticação. Por favor tente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/v1/auth/login', authLimiter);

  // 3. Montagem das Rotas da API REST
  app.use('/api/v1', apiRouter);

  // 4. Servir Frontend (Vite em Desenvolvimento / Dist em Produção)
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[SW-SERVER] Vite middleware montado em modo de desenvolvimento.');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('[SW-SERVER] Ficheiros estáticos montados a partir de dist/.');
    } else {
      console.warn('[SW-SERVER] Diretório dist/ não encontrado. Por favor execute npm run build.');
    }
  }

  // 5. Middleware Global de Tratamento de Erros
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[SW-SERVER ERROR]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Ocorreu um erro interno no servidor.',
    });
  });

  // 6. Iniciar Servidor HTTP
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  SW Service Desk v1.0 | SW Cloud Solutions           `);
    console.log(`  Servidor ativo na porta: ${PORT}                    `);
    console.log(`  Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('[SW-SERVER FATAL] Falha no arranque:', err);
  process.exit(1);
});
