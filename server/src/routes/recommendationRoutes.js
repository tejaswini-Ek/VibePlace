import { Router } from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';

export const recommendationRoutes = Router();
recommendationRoutes.post('/', getRecommendations);
