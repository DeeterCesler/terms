import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-admin-secret'];
  if (typeof provided !== 'string') {
    res.status(401).json({ error: 'Missing X-Admin-Secret header' });
    return;
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(config.adminSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({ error: 'Invalid admin secret' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Invalid admin secret' });
    return;
  }

  next();
}
