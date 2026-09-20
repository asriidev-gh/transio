import { apiError } from '@sessionai/shared';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(apiError(err.code, err.message));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Validation failed';
    res.status(400).json(apiError('VALIDATION_ERROR', message));
    return;
  }

  logger.error('Unhandled error', {
    name: err instanceof Error ? err.name : 'Unknown',
    message: err instanceof Error ? err.message : 'Unknown error',
  });

  res.status(500).json(apiError('INTERNAL_ERROR', 'An unexpected error occurred'));
}
