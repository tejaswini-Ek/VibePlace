import jwt from "jsonwebtoken";

export function createAccessToken(userId: string): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return jwt.sign({ sub: userId }, secret, {
    expiresIn: "7d",
    issuer: "mood-place-finder",
  });
}

export function publicUser(user: {
  _id: unknown;
  name: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}
