import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { updateSettingsSchema } from "./settings.validation.js";
import * as settingsController from "./settings.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", settingsController.getSettings);
router.patch("/", validate(updateSettingsSchema), settingsController.updateSettings);

export default router;
