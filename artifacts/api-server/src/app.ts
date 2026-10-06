import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { HealthCheckResponse } from "@workspace/api-zod";
import { isMongoReady } from "./config/mongo";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.get("/health", (_req, res) => {
  const databaseReady = isMongoReady();
  res.status(200).json(
    HealthCheckResponse.parse({ status: databaseReady ? "ok" : "degraded" }),
  );
});

app.use("/api", apiLimiter, router);

app.use("/api", (req, res) => {
  req.log.warn({ path: req.path }, "API route not found");
  res.status(404).json({ error: "API route not found." });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const err = error instanceof Error ? error : new Error("Unknown server error");
  const status =
    "status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500
      ? err.status
      : 500;
  req.log.error({ err, status }, "Unhandled request error");
  if (!res.headersSent) {
    res.status(status).json({
      error: status === 400 ? "The request body is invalid." : "An unexpected server error occurred.",
    });
  }
});

export default app;
