import { Router } from 'express';
import { listFavourites, addFavourite, removeFavourite } from '../controllers/favouriteController.js';
import { requireAuth } from '../middleware/auth.js';

export const favouriteRoutes = Router();

favouriteRoutes.get('/', requireAuth, listFavourites);
favouriteRoutes.post('/', requireAuth, addFavourite);
favouriteRoutes.delete('/:placeId', requireAuth, removeFavourite);
