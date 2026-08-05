import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { createCustomerSchema, updateCustomerSchema } from "./customers.validation.js";
import * as customersController from "./customers.controller.js";
import { enforcePlanLimit } from "../billing/index.js";

const router = Router();

router.use(authenticate);

router.get("/", customersController.list);
router.get("/:id", customersController.getById);
// Plan limit on customer creation — 402 once the tenant hits their cap.
router.post("/", validate(createCustomerSchema), enforcePlanLimit("customers"), customersController.create);
router.patch("/:id", validate(updateCustomerSchema), customersController.update);
router.delete("/:id", customersController.remove);

export default router;
