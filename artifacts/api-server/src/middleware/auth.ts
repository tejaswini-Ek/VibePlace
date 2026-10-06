import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : req.cookies?.moodplace_session ?? "";
  const secret = process.env.SESSION_SECRET;

  if (!token) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (!secret) {
    res.status(503).json({ error: "Authentication is not configured on this server." });
    return;
  }

  try {
    const payload = jwt.verify(token, secret, { issuer: "mood-place-finder" });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      res.status(401).json({ error: "The sign-in token is invalid." });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Your sign-in has expired. Please sign in again." });
  }
}
