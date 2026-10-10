import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { registerUser, loginUser, logoutUser, getCurrentUser, requestPasswordReset, resetPassword } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

const passwordResetRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please try again later.' },
});

const passwordResetLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again later.' },
});

authRoutes.post('/register', registerUser);
authRoutes.post('/login', loginUser);
authRoutes.post('/forgot-password', passwordResetRequestLimit, requestPasswordReset);
authRoutes.post('/reset-password', passwordResetLimit, resetPassword);
authRoutes.post('/logout', logoutUser);
authRoutes.get('/me', requireAuth, getCurrentUser);
