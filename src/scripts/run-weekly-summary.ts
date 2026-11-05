/**
 * Manual run of the weekly summary — no WhatsApp connection needed.
 *
 * Usage (from the project root):
 *   bun run src/scripts/run-weekly-summary.ts                       # dry run, all configured groups
 *   bun run src/scripts/run-weekly-summary.ts 1203...@g.us          # dry run, one group
 *   bun run src/scripts/run-weekly-summary.ts 1203...@g.us --send   # REAL run (needs a live bot connection, see note)
 *
 * It reads the same .env as the bot (GEMINI_API_KEY, GEMINI_MODEL, Mongo).
 * Dry run: generates the report with Gemini and saves it in
 * weekly_summary_reports (delivered: false), without sending anything and
 * without moving lastSummaryAt — so you can run it as often as you like and
 * inspect the result in Mongo.
 *
 * NOTE on --send: sendMessageToGroup needs the bot's WhatsApp socket, which
 * only exists inside the running bot process. From this standalone script it
 * will fail to send. Use --send only if your send-message.ts works without
 * the socket; otherwise validate with dry runs and let the Friday cron do the
 * real send.
 */
import { WeeklySummaryScheduler } from "../core/schedulers/weekly-summary.scheduler";
import { SummaryService } from "../core/summary/summary.service";
import { initDatabase } from "../database/database.bootstrap";
import logger from "../shared/utils/logger/logger";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const groupJid = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const send = process.argv.includes("--send");

await initDatabase(logger);

const scheduler = new WeeklySummaryScheduler(
  new SummaryService({ apiKey, model: process.env.GEMINI_MODEL }),
);

await scheduler.runWeeklySummaries({ dryRun: !send, groupJid });

process.exit(0);
