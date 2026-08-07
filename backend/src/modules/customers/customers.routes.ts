import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { validateObjectId } from "../../common/middlewares/objectId.js";
import { strictLimiter, generousLimiter } from "../../common/middlewares/rateLimit.js";
import { createCustomerSchema, updateCustomerSchema } from "./customers.validation.js";
import * as customersController from "./customers.controller.js";
import { enforcePlanLimit } from "../billing/index.js";

const router = Router();

router.use(authenticate);
router.use("/:id", validateObjectId);

// Reads are cheap → generous tier. Creation is a write (and plan-limited).
router.get("/", generousLimiter, customersController.list);
router.get("/:id", generousLimiter, customersController.getById);
// Plan limit on customer creation — 402 once the tenant hits their cap.
router.post("/", strictLimiter, validate(createCustomerSchema), enforcePlanLimit("customers"), customersController.create);
router.patch("/:id", strictLimiter, validate(updateCustomerSchema), customersController.update);
router.delete("/:id", strictLimiter, customersController.remove);

export default router;
