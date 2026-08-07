import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { strictLimiter } from "../../common/middlewares/rateLimit.js";
import { validate } from "../../common/middlewares/validate.js";
import { updateUserSchema } from "./users.validation.js";
import * as usersController from "./users.controller.js";

const router = Router();

// Every route below requires a verified Clerk session and is auth-adjacent, so
// it carries the strict per-tenant rate limit.
router.use(authenticate, strictLimiter);

// The old POST /sync route is gone: it trusted userId/email straight from the
// request body, so any caller could have created or hijacked a user record.
// Provisioning now happens inside authenticate(), keyed off the verified token.
router.get("/me", usersController.getProfile);
router.patch("/me", validate(updateUserSchema), usersController.updateProfile);

export default router;
