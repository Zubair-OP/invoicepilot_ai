import { ActivityLog } from "../../database/models/index.js";
import { logger } from "../../observability/logger.js";

interface LogActivityInput {
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await ActivityLog.create(input);
  } catch (error) {
    logger.error({ err: error, action: input.action, userId: input.userId }, "Activity logging failed");
  }
}
