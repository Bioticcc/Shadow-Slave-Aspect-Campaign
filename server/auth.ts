import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import { ACCOUNTS, type AccountUsername } from "@shared/schema";

export type AuthUser = {
  username: AccountUsername;
  isDM: boolean;
};

declare module "express-session" {
  interface SessionData {
    user?: AccountUsername;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const MemoryStore = MemoryStoreFactory(session);

function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const fallback = "dev-local-session-secret-change-in-production";
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[security] SESSION_SECRET is not set; using fallback secret. Set SESSION_SECRET in .env.",
    );
  }
  return fallback;
}

export const sessionMiddleware = session({
  name: "dnd.sid",
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: new MemoryStore({
    checkPeriod: 1000 * 60 * 60 * 4,
  }),
  cookie: {
    httpOnly: true,
    secure: "auto",
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 8,
  },
});

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

const DEFAULT_PASSWORDS: Record<AccountUsername, string> = {
  Tien: "Cleric",
  Marlin: "Bard",
  Nico: "Ranger",
  Ambrose: "Elantrian",
  DM: "Wit",
};

function getPasswordForUser(username: AccountUsername): string {
  const envKey = `ACCOUNT_PASSWORD_${username.toUpperCase()}`;
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_PASSWORDS[username];
}

export function authenticateUser(username: string, password: string): AuthUser | null {
  const account = ACCOUNTS.find((a) => normalizeUsername(a.username) === normalizeUsername(username));
  if (!account) return null;
  if (getPasswordForUser(account.username) !== password) return null;
  return {
    username: account.username,
    isDM: account.username === "DM",
  };
}

export function getSessionUser(req: Request): AuthUser | null {
  const username = req.session?.user;
  if (!username) return null;
  const account = ACCOUNTS.find((a) => a.username === username);
  if (!account) return null;
  return {
    username: account.username,
    isDM: account.username === "DM",
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  req.authUser = user;
  next();
}

export function canManageCharacter(user: AuthUser, owner: string): boolean {
  return user.isDM || user.username === owner;
}
