import { z } from 'zod';

/** Email/password credentials used by auth forms and API validation. */
export const AuthCredentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;

/** Authenticated user profile returned by GET /me. */
export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
