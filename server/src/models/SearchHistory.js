import mongoose from 'mongoose';

const searchHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    category: { type: String, default: 'all', trim: true, maxlength: 40 },
    mood: { type: String, default: 'relax', trim: true, maxlength: 40 },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    radius: { type: Number, default: 10, min: 1, max: 20 },
    resultsCount: {
      type: Number,
      min: 0,
      validate: { validator: Number.isInteger, message: 'Result count must be an integer.' },
    },
  },
  { timestamps: true },
);

searchHistorySchema.pre('validate', function validateCoordinates() {
  const hasLatitude = this.latitude !== undefined;
  const hasLongitude = this.longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    this.invalidate('latitude', 'Both latitude and longitude must be provided together.');
  }
});

searchHistorySchema.index({ userId: 1, createdAt: -1 });

export const SearchHistory = mongoose.models.SearchHistory || mongoose.model('SearchHistory', searchHistorySchema);
