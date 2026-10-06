import { model, models, Schema } from "mongoose";

const favouriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    placeId: { type: Schema.Types.ObjectId, ref: "Place", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

favouriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });

export const FavouriteModel = models.Favourite ?? model("Favourite", favouriteSchema);
