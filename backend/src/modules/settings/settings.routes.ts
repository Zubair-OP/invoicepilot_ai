import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { strictLimiter } from "../../common/middlewares/rateLimit.js";
import { updateSettingsSchema } from "./settings.validation.js";
import * as settingsController from "./settings.controller.js";

const router = Router();

// Auth-adjacent (reads + writes tenant defaults), so the strict tier applies.
router.use(authenticate, strictLimiter);

router.get("/", settingsController.getSettings);
router.patch("/", validate(updateSettingsSchema), settingsController.updateSettings);

export default router;
