import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { runWithLogContext } from "../../observability/context.js";

export function requestId(req: Request, _res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string) || uuidv4();
  req.id = id;
  // Run the rest of the request inside the correlation context so the logger's
  // mixin stamps every log line with this requestId (see observability/logger.ts).
  runWithLogContext({ requestId: id }, () => next());
}
