import { Router } from "express";
import type { Request, Response } from "express";
import { HEALTH_CHECK_RESPONSE } from "@lokaltreu/types";
import { secureDeviceHandler } from "../handlers/devices/secureDeviceHandler.js";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.status(200).type("application/json").json(HEALTH_CHECK_RESPONSE);
});

router.post("/secure-device", secureDeviceHandler);

export default router;
