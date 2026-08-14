import type { Request, Response, NextFunction, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  key?: (req: Request) => string;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

function getIpKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, RateBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.key ? options.key(req) : getIpKey(req);
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: options.message || "Too many requests, please try again shortly.",
      });
    }

    next();
  };
}

const BLOCKED_PATTERNS = [
  "/proc/self/environ",
  "/.env",
  "/.git",
  "/wp-admin",
  "/wp-login",
  "/phpmyadmin",
  "/cgi-bin",
  "/actuator",
];

export function blockSuspiciousPaths(req: Request, res: Response, next: NextFunction) {
  const path = (req.path || "").toLowerCase();
  if (BLOCKED_PATTERNS.some((pattern) => path.includes(pattern))) {
    return res.status(404).send("Not Found");
  }
  next();
}
