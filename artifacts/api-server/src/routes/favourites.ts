import { Router, type IRouter } from "express";
import {
  AddFavouriteBody,
  AddFavouriteResponse,
  ListFavouritesResponse,
  RemoveFavouriteParams,
  RemoveFavouriteResponse,
} from "@workspace/api-zod";
import { requireMongo } from "../config/mongo";
import { requireAuth } from "../middleware/auth";
import { FavouriteModel } from "../models/Favourite";
import { PlaceModel } from "../models/Place";

const router: IRouter = Router();
router.use("/favourites", requireAuth);

function databaseUnavailable(res: import("express").Response): void {
  res.status(503).json({ error: "MongoDB is not connected; favourites cannot be saved yet." });
}

function placePayload(record: Record<string, unknown>) {
  const externalId = String(record.externalId ?? record.id ?? "");
  return {
    id: externalId,
    externalId,
    name: String(record.name ?? ""),
    category: String(record.category ?? "place"),
    address: String(record.address ?? ""),
    city: (record.city as string | null | undefined) ?? null,
    state: (record.state as string | null | undefined) ?? null,
    country: (record.country as string | null | undefined) ?? null,
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
  };
}

router.get("/favourites", async (req, res): Promise<void> => {
  if (!requireMongo()) {
    databaseUnavailable(res);
    return;
  }
  try {
    const records = await FavouriteModel.find({ userId: req.userId })
      .populate("placeId")
      .sort({ createdAt: -1 })
      .lean();
    const favourites = records
      .filter((record) => record.placeId && typeof record.placeId === "object")
      .map((record) => {
        const place = record.placeId as unknown as Record<string, unknown>;
        return {
          id: String(record._id),
          createdAt: record.createdAt,
          place: {
            id: String(place.externalId),
            externalId: String(place.externalId),
            name: String(place.name),
            category: String(place.category),
            address: String(place.address),
            city: (place.city as string | null) ?? null,
            state: (place.state as string | null) ?? null,
            country: (place.country as string | null) ?? null,
            latitude: Number(place.latitude),
            longitude: Number(place.longitude),
            distanceKm: null,
          },
        };
      });
    res.json(ListFavouritesResponse.parse(favourites));
  } catch (err) {
    req.log.error({ err }, "Favourite list failed");
    res.status(500).json({ error: "Could not load your saved places." });
  }
});

router.post("/favourites", async (req, res): Promise<void> => {
  const parsed = AddFavouriteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The place information is incomplete." });
    return;
  }
  if (!requireMongo()) {
    databaseUnavailable(res);
    return;
  }
  try {
    const placeData = placePayload(parsed.data);
    const place = await PlaceModel.findOneAndUpdate(
      { externalId: placeData.externalId },
      { $set: placeData },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const favourite = await FavouriteModel.findOneAndUpdate(
      { userId: req.userId, placeId: place._id },
      { $setOnInsert: { userId: req.userId, placeId: place._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.status(201).json(
      AddFavouriteResponse.parse({
        id: String(favourite._id),
        createdAt: favourite.createdAt,
        place: { ...placeData, distanceKm: null },
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Saving favourite failed");
    res.status(500).json({ error: "Could not save this place." });
  }
});

router.delete("/favourites/:placeId", async (req, res): Promise<void> => {
  const params = RemoveFavouriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid place identifier." });
    return;
  }
  if (!requireMongo()) {
    databaseUnavailable(res);
    return;
  }
  try {
    const place = await PlaceModel.findOne({ externalId: params.data.placeId }).select("_id").lean();
    if (place) {
      await FavouriteModel.deleteOne({ userId: req.userId, placeId: place._id });
    }
    res.json(RemoveFavouriteResponse.parse({ message: "Place removed from favourites." }));
  } catch (err) {
    req.log.error({ err }, "Removing favourite failed");
    res.status(500).json({ error: "Could not remove this saved place." });
  }
});

export default router;
