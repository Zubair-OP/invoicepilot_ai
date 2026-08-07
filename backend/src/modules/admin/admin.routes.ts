import { Router } from "express";
import { authenticate, authorize } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { updateUserRoleSchema } from "./admin.validation.js";
import { dashboardRangeSchema } from "../dashboard/dashboard.validation.js";
import * as adminController from "./admin.controller.js";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUser);
router.patch("/users/:id/role", validate(updateUserRoleSchema), adminController.updateUserRole);
router.get("/analytics", validate(dashboardRangeSchema, "query"), adminController.getAnalytics);

export default router;
