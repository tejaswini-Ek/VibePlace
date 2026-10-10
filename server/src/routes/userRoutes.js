import { Router } from 'express';
import { getUserProfile } from '../controllers/userController.js';

export const userRoutes = Router();
userRoutes.get('/me', getUserProfile);
