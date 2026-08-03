import { Router } from "express";
import { authenticate } from "../../common/middlewares/auth.js";
import { validate } from "../../common/middlewares/validate.js";
import { createCustomerSchema, updateCustomerSchema } from "./customers.validation.js";
import * as customersController from "./customers.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", customersController.list);
router.get("/:id", customersController.getById);
router.post("/", validate(createCustomerSchema), customersController.create);
router.patch("/:id", validate(updateCustomerSchema), customersController.update);
router.delete("/:id", customersController.remove);

export default router;
