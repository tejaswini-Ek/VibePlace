import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import { signToken } from '../middleware/auth.js';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    profileImage: user.profileImage || null,
    preferredLocation: user.preferredLocation || null,
    createdAt: user.createdAt,
  };
}

const resetRequestMessage = 'If an account matches that email address, a password reset link will be sent.';

function resetEmailSettings() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.RESET_EMAIL_FROM?.trim();
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const clientUrl = process.env.CLIENT_URL?.split(',')[0]?.trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from || !['true', 'false'].includes(secure) || !clientUrl) {
    return null;
  }
  let baseUrl;
  try {
    baseUrl = new URL(clientUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol)) return null;
  return {
    host,
    port,
    secure: secure === 'true',
    user,
    pass,
    from,
    clientUrl: baseUrl.origin,
  };
}

export async function requestPasswordReset(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  try {
    const settings = resetEmailSettings();
    if (!settings) {
      return res.status(503).json({
        error: 'Password reset email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, and RESET_EMAIL_FROM on the server.',
      });
    }

    const user = await User.findOne({ email }).select('_id');
    if (!user) return res.status(202).json({ message: resetRequestMessage });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await User.updateOne(
      { _id: user._id },
      { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt } },
    );

    const resetUrl = new URL('/reset-password', settings.clientUrl);
    resetUrl.searchParams.set('token', token);
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.pass },
    });
    try {
      await transport.sendMail({
        from: settings.from,
        to: email,
        subject: 'Reset your Mood Place password',
        text: `Use this link to reset your password. It expires in 30 minutes and can only be used once:\n\n${resetUrl.href}\n\nIf you did not request a password reset, you can ignore this email.`,
        html: `<p>Use the link below to reset your password. It expires in 30 minutes and can only be used once.</p><p><a href="${resetUrl.href}">Reset your password</a></p><p>If you did not request a password reset, you can ignore this email.</p>`,
      });
    } catch (error) {
      await User.updateOne(
        { _id: user._id, resetTokenHash: tokenHash },
        { $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 } },
      );
      console.error('Password reset email delivery failed:', { name: error.name || 'Error', code: error.code || null });
      return res.status(503).json({ error: 'Password reset email could not be sent. Please try again later.' });
    } finally {
      transport.close();
    }

    return res.status(202).json({ message: resetRequestMessage });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(400).json({ error: 'This password reset link is invalid or expired. Request a new link.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const updatedUser = await User.findOneAndUpdate(
      { resetTokenHash: tokenHash, resetTokenExpiresAt: { $gt: new Date() } },
      {
        $set: { passwordHash },
        $inc: { authVersion: 1 },
        $unset: { resetTokenHash: 1, resetTokenExpiresAt: 1 },
      },
      { new: true, runValidators: true },
    );
    if (!updatedUser) {
      return res.status(400).json({ error: 'This password reset link is invalid or expired. Request a new link.' });
    }

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
}

export async function registerUser(req, res, next) {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }
  if (
    name.length > 100 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({ error: 'Enter a valid name and email, and a password of 8 to 128 characters.' });
  }

  try {
    const user = new User({ name, email, passwordHash: password });
    await user.save();
    const token = signToken(user);
    res.cookie('token', token, cookieOptions);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    return next(error);
  }
}

export async function loginUser(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.cookie('token', token, cookieOptions);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export function logoutUser(req, res) {
  const { maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie('token', clearOptions);
  return res.json({ success: true, message: 'Logged out.' });
}

export function getCurrentUser(req, res) {
  return res.json(publicUser(req.user));
}
