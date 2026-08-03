import { Request, Response, NextFunction } from "express";
import * as customersService from "./customers.service.js";
import { getPaginationParams } from "../../common/utils/pagination.js";
import { successResponse, createdResponse } from "../../common/response.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = getPaginationParams(req.query as { page?: string; limit?: string });
    const search = req.query.search as string | undefined;
    const result = await customersService.list(req.user!.userId, pagination, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.getById(req.user!.userId, req.params.id);
    res.json(successResponse(customer));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.create(req.user!.userId, req.body);
    res.status(201).json(createdResponse(customer));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customersService.update(req.user!.userId, req.params.id, req.body);
    res.json(successResponse(customer, "Customer updated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await customersService.remove(req.user!.userId, req.params.id);
    res.json(successResponse(null, "Customer deleted successfully"));
  } catch (error) {
    next(error);
  }
}
