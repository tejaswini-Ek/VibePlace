import { Router } from 'express';
import { addHistory, deleteHistory, listHistory } from '../controllers/searchHistoryController.js';
import { requireAuth } from '../middleware/auth.js';

export const historyRoutes = Router();

historyRoutes.get('/', requireAuth, listHistory);
historyRoutes.post('/', requireAuth, addHistory);
historyRoutes.delete('/:historyId', requireAuth, deleteHistory);
