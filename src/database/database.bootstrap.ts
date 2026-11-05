import type { ILogger } from "../shared/utils/logger/logger";
import { getMongoClient } from "./mongo";
import { getMessageLogCollection } from "./models/messageLog.model";

export async function initDatabase(logger: ILogger): Promise<void> {
  logger.info("Connecting to database...");

  try {
    const client = getMongoClient();
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    logger.info("✅ Database connected");

    await ensureIndexes(logger);
  } catch (error) {
    logger.error("Database connection failed", { error });
    throw error;
  }
}

/**
 * Creates indexes that don't exist yet. createIndex is idempotent — safe
 * to call on every startup, Mongo no-ops if the index is already there
 * with the same options.
 */
async function ensureIndexes(logger: ILogger): Promise<void> {
  // TTL: documents are auto-deleted 14 days after insertion (createdAt).
  await getMessageLogCollection().createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 14 },
  );

  // Supports MessageHistoryService.buildWeeklyHistory's query shape
  // (filter by groupWhatsappId, range on timestamp) without a collection scan.
  await getMessageLogCollection().createIndex({
    groupWhatsappId: 1,
    timestamp: 1,
  });

  logger.info("✅ Database indexes ensured");
}
