import { Router, type IRouter } from "express";
import { GetCurrentUserResponse } from "@workspace/api-zod";
import { requireMongo } from "../config/mongo";
import { requireAuth } from "../middleware/auth";
import { UserModel } from "../models/User";
import { publicUser } from "../services/auth";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  if (!requireMongo()) {
    res.status(503).json({ error: "MongoDB is not connected; your profile is unavailable." });
    return;
  }
  try {
    const user = await UserModel.findById(req.userId).lean();
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    res.json(GetCurrentUserResponse.parse(publicUser(user)));
  } catch (err) {
    req.log.error({ err }, "Profile lookup failed");
    res.status(500).json({ error: "Could not load your profile." });
  }
});

export default router;
