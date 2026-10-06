import { model, models, Schema } from "mongoose";

const placeSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    address: { type: String, required: true },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { timestamps: true },
);

export const PlaceModel = models.Place ?? model("Place", placeSchema);
