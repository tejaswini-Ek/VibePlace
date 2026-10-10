import { Router } from 'express';
import { searchPlaces } from '../controllers/placeController.js';

export const placeRoutes = Router();
placeRoutes.get('/', searchPlaces);
