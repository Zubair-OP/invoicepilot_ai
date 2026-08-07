import { Router } from "express";
import { generousLimiter } from "../common/middlewares/rateLimit.js";
import { healthCheck } from "./health.controller.js";

const router = Router();
router.get("/", generousLimiter, healthCheck);

export default router;
