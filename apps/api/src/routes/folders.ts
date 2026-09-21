import {
  apiSuccess,
  CreateFolderSchema,
  FolderIdParamSchema,
  UpdateFolderSchema,
} from '@sessionai/shared';
import { Router, type Request, type RequestHandler } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error-handler.js';
import { createSupabaseUserClient } from '../lib/supabase.js';
import {
  SupabaseFolderRepository,
  type FolderRepository,
} from '../services/folders/repository.js';

export type FolderRepoFactory = (req: Request) => FolderRepository;

function defaultFolderRepoFactory(req: Request): FolderRepository {
  if (!req.accessToken) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return new SupabaseFolderRepository(createSupabaseUserClient(req.accessToken));
}

export function createFoldersRouter(options: {
  createRepository?: FolderRepoFactory;
  authenticate?: RequestHandler;
} = {}): Router {
  const router = Router();
  const createRepository = options.createRepository ?? defaultFolderRepoFactory;
  const authenticate = options.authenticate ?? requireAuth;

  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const folders = await createRepository(req).list(req.user.id);
      res.status(200).json(apiSuccess(folders));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const input = CreateFolderSchema.parse(req.body);
      const folder = await createRepository(req).create(req.user.id, input);
      res.status(201).json(apiSuccess(folder));
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const { id } = FolderIdParamSchema.parse(req.params);
      const folder = await createRepository(req).getById(req.user.id, id);
      if (!folder) throw new AppError('NOT_FOUND', 'Folder not found', 404);
      res.status(200).json(apiSuccess(folder));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const { id } = FolderIdParamSchema.parse(req.params);
      const input = UpdateFolderSchema.parse(req.body);
      const folder = await createRepository(req).update(req.user.id, id, input);
      if (!folder) throw new AppError('NOT_FOUND', 'Folder not found', 404);
      res.status(200).json(apiSuccess(folder));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
      const { id } = FolderIdParamSchema.parse(req.params);
      const deleted = await createRepository(req).delete(req.user.id, id);
      if (!deleted) throw new AppError('NOT_FOUND', 'Folder not found', 404);
      res.status(200).json(apiSuccess({ id }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
