import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { generousLimiter } from "../../common/middlewares/rateLimit.js";
import * as googleController from "./google.controller.js";

const router = Router();

// OAuth start
router.get("/auth-url", authenticate, generousLimiter, googleController.getAuthUrl);

// OAuth callback from Google (public callback with state param)
router.get("/callback", googleController.handleCallback);

// Status and disconnect
router.get("/status", authenticate, generousLimiter, googleController.getStatus);
router.delete("/disconnect", authenticate, generousLimiter, googleController.disconnect);

export default router;
