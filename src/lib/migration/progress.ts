import { redis } from "../redis";

export interface MigrationProgress {
  migrationId: string;
  phase: "custom_fields" | "contacts" | "conversations" | "opportunities" | "appointments" | "finalizing";
  processed: number;
  total: number;
  failed: number;
  currentRecord?: string;
  message?: string;
}

/**
 * Emit a migration progress event via Redis pub/sub.
 */
export async function emitProgress(progress: MigrationProgress): Promise<void> {
  await redis.publish(
    `migration:${progress.migrationId}:progress`,
    JSON.stringify(progress)
  );
}

/**
 * Emit a migration completion event.
 */
export async function emitComplete(
  migrationId: string,
  status: "completed" | "completed_with_errors" | "failed",
  summary?: Record<string, unknown>
): Promise<void> {
  await redis.publish(
    `migration:${migrationId}:progress`,
    JSON.stringify({
      migrationId,
      phase: "finalizing",
      status,
      summary,
      completed: true,
    })
  );
}
