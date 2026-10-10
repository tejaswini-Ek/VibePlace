import { Router } from 'express';
import { getWeather } from '../controllers/weatherController.js';

export const weatherRoutes = Router();
weatherRoutes.get('/', getWeather);
