import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { generousLimiter } from "../../common/middlewares/rateLimit.js";
import { dashboardRangeSchema } from "./dashboard.validation.js";
import * as dashboardController from "./dashboard.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", generousLimiter, validate(dashboardRangeSchema, "query"), dashboardController.getDashboard);

export default router;
