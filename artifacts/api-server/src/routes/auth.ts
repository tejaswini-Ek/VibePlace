import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import {
  LoginUserBody,
  LoginUserResponse,
  LogoutUserResponse,
  RegisterUserBody,
  RegisterUserResponse,
} from "@workspace/api-zod";
import { requireMongo } from "../config/mongo";
import { UserModel } from "../models/User";
import { createAccessToken, publicUser } from "../services/auth";

const router: IRouter = Router();
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setSessionCookie(res: import("express").Response, token: string): void {
  res.cookie("moodplace_session", token, cookieOptions);
}

function databaseUnavailable(res: import("express").Response): void {
  res.status(503).json({
    error: "MongoDB is not connected. Add MONGODB_URI in Replit Secrets to enable accounts.",
  });
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a name, valid email, and password with at least 8 characters." });
    return;
  }
  if (!requireMongo()) {
    databaseUnavailable(res);
    return;
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(503).json({ error: "Authentication signing is not configured." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const existing = await UserModel.findOne({ email }).select("_id").lean();
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await UserModel.create({
      name: parsed.data.name.trim(),
      email,
      passwordHash,
    });
    const token = createAccessToken(String(user._id));
    if (!token) {
      res.status(503).json({ error: "Authentication signing is not configured." });
      return;
    }

    setSessionCookie(res, token);
    req.log.info({ userId: String(user._id) }, "New account registered");
    res.status(201).json(
      RegisterUserResponse.parse({ token, user: publicUser(user) }),
    );
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "Could not create the account. Please try again." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }
  if (!requireMongo()) {
    databaseUnavailable(res);
    return;
  }
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: "Authentication signing is not configured." });
    return;
  }

  try {
    const user = await UserModel.findOne({
      email: parsed.data.email.trim().toLowerCase(),
    }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }
    const token = createAccessToken(String(user._id));
    if (!token) {
      res.status(503).json({ error: "Authentication signing is not configured." });
      return;
    }
    setSessionCookie(res, token);
    req.log.info({ userId: String(user._id) }, "User signed in");
    res.json(LoginUserResponse.parse({ token, user: publicUser(user) }));
  } catch (err) {
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: "Could not sign in. Please try again." });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.clearCookie("moodplace_session", { ...cookieOptions, maxAge: undefined });
  res.json(LogoutUserResponse.parse({ message: "Signed out on this device." }));
});

export default router;
