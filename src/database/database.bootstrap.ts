import type { ILogger } from "../shared/utils/logger/logger";
import { getMongoClient } from "./mongo";
import { getGroupSummaryConfigCollection } from "./models/groupSummaryConfig.model";
import { getMessageLogCollection } from "./models/messageLog.model";
import { getWeeklySummaryReportCollection } from "./models/weeklySummaryReport.model";

/** Raw message text is kept this long, then Mongo deletes it by itself. */
const MESSAGE_LOG_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

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
 * Creates the indexes that don't exist yet. createIndex is idempotent — safe
 * on every startup; Mongo does nothing if the same index is already there.
 */
async function ensureIndexes(logger: ILogger): Promise<void> {
  // TTL: message logs are deleted 14 days after insertion (createdAt).
  await getMessageLogCollection().createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: MESSAGE_LOG_TTL_SECONDS },
  );

  // Supports MessageHistoryService.buildWeeklyHistory (filter by group,
  // range on timestamp) without a collection scan.
  await getMessageLogCollection().createIndex({
    groupWhatsappId: 1,
    timestamp: 1,
  });

  // One summary config per group (the document's existence = enabled).
  await getGroupSummaryConfigCollection().createIndex(
    { groupWhatsappId: 1 },
    { unique: true },
  );

  // Supports WeeklySummaryReportService.findLatest / findHistory.
  await getWeeklySummaryReportCollection().createIndex({
    groupWhatsappId: 1,
    generatedAt: -1,
  });

  logger.info("✅ Database indexes ensured");
}
