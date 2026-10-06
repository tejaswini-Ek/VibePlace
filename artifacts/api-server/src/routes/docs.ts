import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Router, type IRouter } from "express";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";

const router: IRouter = Router();
const openApiPath = resolve(import.meta.dirname, "../../../lib/api-spec/openapi.yaml");
const openApiSource = readFileSync(openApiPath, "utf8");
const openApiDocument = parseYaml(openApiSource) as swaggerUi.JsonObject;

router.get("/openapi.yaml", (_req, res): void => {
  res.type("text/yaml").send(openApiSource);
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

export default router;
