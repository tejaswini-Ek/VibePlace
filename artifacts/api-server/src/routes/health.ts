import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isMongoReady } from "../config/mongo";

const router: IRouter = Router();

function healthStatus() {
  return HealthCheckResponse.parse({
    status: isMongoReady() ? "ok" : "degraded",
  });
}

router.get("/healthz", (_req, res) => {
  const data = healthStatus();
  res.status(200).json(data);
});

router.get("/health", (_req, res) => {
  const data = healthStatus();
  res.status(200).json(data);
});

export default router;
