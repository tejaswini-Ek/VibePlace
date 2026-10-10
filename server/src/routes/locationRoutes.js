import { Router } from 'express';
import { searchLocations } from '../controllers/locationController.js';

export const locationRoutes = Router();
locationRoutes.get('/search', searchLocations);
