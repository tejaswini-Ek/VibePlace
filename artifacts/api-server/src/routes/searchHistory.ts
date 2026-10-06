import { Router, type IRouter } from "express";
import {
  ListSearchHistoryQueryParams,
  ListSearchHistoryResponse,
  SaveSearchHistoryBody,
  SaveSearchHistoryResponse,
} from "@workspace/api-zod";
import { requireMongo } from "../config/mongo";
import { requireAuth } from "../middleware/auth";
import { SearchHistoryModel } from "../models/SearchHistory";

const router: IRouter = Router();
router.use("/search-history", requireAuth);

router.get("/search-history", async (req, res): Promise<void> => {
  const parsed = ListSearchHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid history limit." });
    return;
  }
  if (!requireMongo()) {
    res.status(503).json({ error: "MongoDB is not connected; search history is unavailable." });
    return;
  }
  try {
    const records = await SearchHistoryModel.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(parsed.data.limit)
      .lean();
    res.json(
      ListSearchHistoryResponse.parse(
        records.map((record) => ({
          id: String(record._id),
          location: record.location,
          category: record.category,
          mood: record.mood,
          latitude: record.latitude,
          longitude: record.longitude,
          createdAt: record.createdAt,
        })),
      ),
    );
  } catch (err) {
    req.log.error({ err }, "Search history lookup failed");
    res.status(500).json({ error: "Could not load search history." });
  }
});

router.post("/search-history", async (req, res): Promise<void> => {
  const parsed = SaveSearchHistoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The search location and category are required." });
    return;
  }
  if (!requireMongo()) {
    res.status(503).json({ error: "MongoDB is not connected; search history cannot be saved." });
    return;
  }
  try {
    const record = await SearchHistoryModel.create({
      userId: req.userId,
      location: parsed.data.location,
      category: parsed.data.category,
      mood: parsed.data.mood ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    });
    res.status(201).json(
      SaveSearchHistoryResponse.parse({
        id: String(record._id),
        location: record.location,
        category: record.category,
        mood: record.mood,
        latitude: record.latitude,
        longitude: record.longitude,
        createdAt: record.createdAt,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Saving search history failed");
    res.status(500).json({ error: "Could not save this search." });
  }
});

export default router;
