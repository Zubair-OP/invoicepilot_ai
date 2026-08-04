import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import * as templatesController from "./templates.controller.js";

const router = Router();

router.use(authenticate);

// The template list is a static, non-tenant resource, but it stays behind
// authenticate() to keep the whole /api/v1 surface consistently authenticated.
router.get("/", templatesController.list);

export default router;
