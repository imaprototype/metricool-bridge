import { and, desc, eq } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import { getDb } from "@/lib/db"
import { syncLogs } from "@/db/schema"

export type SyncLog = InferSelectModel<typeof syncLogs>
export type NewSyncLog = InferInsertModel<typeof syncLogs>

/** Registra una acción de sincronización (CREATE/UPDATE/DELETE/VERIFY) sobre un Asset o Publication. */
export async function recordSyncLog(data: Omit<NewSyncLog, "id" | "createdAt">): Promise<SyncLog> {
  const [log] = await getDb().insert(syncLogs).values(data).returning()
  return log
}

export async function listSyncLogsForEntity(
  entityType: SyncLog["entityType"],
  entityId: string
): Promise<SyncLog[]> {
  return getDb()
    .select()
    .from(syncLogs)
    .where(and(eq(syncLogs.entityType, entityType), eq(syncLogs.entityId, entityId)))
    .orderBy(desc(syncLogs.createdAt))
}
