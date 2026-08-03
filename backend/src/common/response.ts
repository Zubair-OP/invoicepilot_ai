import type { ApiResponse, PaginatedResponse, PaginationMeta } from "./types/index.js";

export type { ApiResponse, PaginatedResponse, PaginationMeta };

export function successResponse<T>(data: T, message = "Success"): ApiResponse<T> {
  return { success: true, message, data };
}

export function createdResponse<T>(data: T, message = "Created successfully"): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message = "Success"
): PaginatedResponse<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(message: string, code: string, errors?: Record<string, string[]>) {
  const response: ApiResponse = { success: false, message, code };
  if (errors) {
    response.errors = errors;
  }
  return response;
}
