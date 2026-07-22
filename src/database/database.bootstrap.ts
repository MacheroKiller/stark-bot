import type { ILogger } from "../shared/utils/logger";
import { client } from "./mongo";

export async function initDatabase(logger: ILogger): Promise<void> {
  logger.info("Connecting to database...");

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    logger.info("✅ Database connected");
  } catch (error) {
    logger.error("Database connection failed", { error });
    throw error;
  }
}
