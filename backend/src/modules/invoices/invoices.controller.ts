import { Request, Response, NextFunction } from "express";
import * as invoicesService from "./invoices.service.js";
import { getPaginationParams } from "../../common/utils/pagination.js";
import { successResponse, createdResponse } from "../../common/response.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pagination = getPaginationParams(req.query as { page?: string; limit?: string });
    const filters = {
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
    };
    const result = await invoicesService.list(req.user!.userId, pagination, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.getById(req.user!.userId, req.params.id);
    res.json(successResponse(invoice));
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.create(req.user!.userId, req.body);
    res.status(201).json(createdResponse(invoice));
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.update(req.user!.userId, req.params.id, req.body);
    res.json(successResponse(invoice, "Invoice updated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await invoicesService.remove(req.user!.userId, req.params.id);
    res.json(successResponse(null, "Invoice deleted successfully"));
  } catch (error) {
    next(error);
  }
}

export async function markAsSent(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.markAsSent(req.user!.userId, req.params.id);
    res.json(successResponse(invoice, "Invoice marked as sent"));
  } catch (error) {
    next(error);
  }
}

export async function markAsPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.markAsPaid(req.user!.userId, req.params.id);
    res.json(successResponse(invoice, "Invoice marked as paid"));
  } catch (error) {
    next(error);
  }
}

export async function voidInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.voidInvoice(req.user!.userId, req.params.id);
    res.json(successResponse(invoice, "Invoice voided successfully"));
  } catch (error) {
    next(error);
  }
}

export async function unvoidInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoicesService.unvoidInvoice(req.user!.userId, req.params.id);
    res.json(successResponse(invoice, "Invoice restored successfully"));
  } catch (error) {
    next(error);
  }
}
