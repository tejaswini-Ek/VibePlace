import mongoose from 'mongoose';

const placeSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, match: /^(node|way|relation)-\d+$/ },
    osmType: { type: String, enum: ['node', 'way', 'relation'], required: true },
    osmId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, default: null, maxlength: 500 },
    city: { type: String, default: null, maxlength: 100 },
    state: { type: String, default: null, maxlength: 100 },
    country: { type: String, default: null, maxlength: 100 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    rating: { type: Number, default: null, min: 0, max: 5 },
    priceRange: { type: String, default: null, maxlength: 20 },
    image: { type: String, default: null, maxlength: 2048 },
    description: { type: String, default: null, maxlength: 600 },
    openingHours: { type: String, default: null, maxlength: 500 },
    phone: { type: String, default: null, maxlength: 100 },
    website: { type: String, default: null, maxlength: 2048 },
    source: { type: String, enum: ['OpenStreetMap'], required: true },
  },
  { _id: false, strict: 'throw' },
);

const favouriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    placeId: { type: String, required: true, match: /^(node|way|relation)-\d+$/ },
    place: { type: placeSnapshotSchema, required: true },
  },
  { timestamps: true },
);

favouriteSchema.index({ userId: 1, placeId: 1 }, { unique: true });
favouriteSchema.index({ userId: 1, createdAt: -1 });

export const Favourite = mongoose.models.Favourite || mongoose.model('Favourite', favouriteSchema);
