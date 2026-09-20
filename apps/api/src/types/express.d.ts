import type { AuthUser } from '@sessionai/shared';

export type AuthedUser = AuthUser;

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      accessToken?: string;
    }
  }
}

export {};
