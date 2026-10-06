import { model, models, Schema } from "mongoose";

const searchHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 240 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    mood: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const SearchHistoryModel =
  models.SearchHistory ?? model("SearchHistory", searchHistorySchema);
