import { z } from 'zod';

export const SessionFolderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SessionFolder = z.infer<typeof SessionFolderSchema>;

export const CreateFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(80, 'Folder name must be 80 characters or fewer'),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

export const UpdateFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(80, 'Folder name must be 80 characters or fewer'),
});

export type UpdateFolderInput = z.infer<typeof UpdateFolderSchema>;

export const FolderIdParamSchema = z.object({
  id: z.string().uuid('Invalid folder id'),
});
