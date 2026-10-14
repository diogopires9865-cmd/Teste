/**
 * SW Service Desk v1.0 - Health Check Controller
 * Organização: SW Cloud Solutions
 */

import { Request, Response } from 'express';
import { db } from '../db/connection.js';

export class HealthController {
  static async check(_req: Request, res: Response) {
    try {
      const startTime = Date.now();
      await db.query('SELECT 1 as ping;');
      const latencyMs = Date.now() - startTime;

      const memoryUsage = process.memoryUsage();

      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'SW Service Desk',
        organization: 'SW Cloud Solutions',
        database: {
          status: 'connected',
          engine: db.isUsingSqliteFallback() ? 'sqlite-relational' : 'mysql-production',
          latency_ms: latencyMs,
        },
        system: {
          uptime_seconds: Math.floor(process.uptime()),
          node_version: process.version,
          memory_rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          memory_heap_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
      });
    } catch (err: any) {
      return res.status(503).json({
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
