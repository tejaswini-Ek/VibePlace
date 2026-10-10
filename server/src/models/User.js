import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, minlength: 8, maxlength: 128, select: false },
    authVersion: { type: Number, default: 0, min: 0 },
    resetTokenHash: { type: String, select: false, index: { unique: true, sparse: true } },
    resetTokenExpiresAt: { type: Date, select: false },
    profileImage: {
      type: String,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: (value) => !value || /^https:\/\/\S+$/i.test(value),
        message: 'Profile images must use HTTPS URLs.',
      },
    },
    preferredLocation: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
});

userSchema.methods.comparePassword = async function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_, ret) => {
    delete ret.passwordHash;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpiresAt;
    return ret;
  },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
