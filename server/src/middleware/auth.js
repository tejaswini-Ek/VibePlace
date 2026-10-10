import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User.js';

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required.');
  return jwt.sign({
    userId: user._id || user.id,
    email: user.email,
    authVersion: user.authVersion ?? 0,
  }, secret, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Authentication is not configured.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  if (!mongoose.isValidObjectId(payload.userId)) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const user = await User.findById(payload.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    if ((payload.authVersion ?? 0) !== (user.authVersion ?? 0)) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
