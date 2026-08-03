import type { PaginationParams } from "../types/index.js";

export type { PaginationParams };

export function getPaginationParams(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
  return { page, limit };
}

export function getSkipTake(params: PaginationParams) {
  return {
    skip: (params.page - 1) * params.limit,
    take: params.limit,
  };
}

export function buildPaginationMeta(total: number, params: PaginationParams) {
  const totalPages = Math.ceil(total / params.limit);
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}
