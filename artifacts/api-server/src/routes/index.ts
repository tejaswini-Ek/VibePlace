import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import favouritesRouter from "./favourites";
import locationsRouter from "./locations";
import placesRouter from "./places";
import recommendationsRouter from "./recommendations";
import searchHistoryRouter from "./searchHistory";
import weatherRouter from "./weather";
import usersRouter from "./users";
import docsRouter from "./docs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(locationsRouter);
router.use(placesRouter);
router.use(recommendationsRouter);
router.use(weatherRouter);
router.use(favouritesRouter);
router.use(searchHistoryRouter);
router.use(usersRouter);
router.use(docsRouter);

export default router;
