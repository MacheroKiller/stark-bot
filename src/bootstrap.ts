import { handlers } from "./commands/command.registry";
import { WeeklySummaryScheduler } from "./core/schedulers/weekly-summary.scheduler";
import { SummaryService } from "./core/summary/summary.service";
import { whatsappClient } from "./core/whatsapp/client";
import { initDatabase } from "./database/database.bootstrap";
import { GlobalCommandConfigService } from "./database/services/GlobalCommandConfigService/globalCommandConfig.service";
import { GroupSummaryConfigService } from "./database/services/GroupSummaryConfigService/groupSummaryConfig.service";
import type { ILogger } from "./shared/utils/logger/logger";
import logger, { createLogger } from "./shared/utils/logger/logger";

export class Application {
  private readonly logger: ILogger;

  constructor() {
    this.logger = createLogger();
  }

  async initialize(): Promise<void> {
    this.logger.info("🚀 Initializing Stark Bot...");

    await initDatabase(this.logger);
    await this.seedCommandConfig();
    // Must finish BEFORE WhatsApp starts delivering messages: the
    // messages.upsert handler checks this in-memory cache to decide which
    // groups get their text logged.
    await new GroupSummaryConfigService().loadCache();
    await this.initializeWhatsApp();
    this.startWeeklySummaryScheduler();

    this.logger.info("Stark Bot initialized successfully");
  }

  // ---------------------------------------------------------------------------
  // Command config
  // ---------------------------------------------------------------------------

  private async seedCommandConfig(): Promise<void> {
    this.logger.info("Seeding global command config...");
    const globalCommandConfigService = new GlobalCommandConfigService();
    await globalCommandConfigService.seedDefaults(
      handlers.map((h) => h.command),
    );
    this.logger.info(
      `Global command config ready (${handlers.length} commands).`,
    );
  }

  // ---------------------------------------------------------------------------
  // Weekly summary (Gemini)
  // ---------------------------------------------------------------------------

  /**
   * Not a command, so /globaldisable can't pause it. Global killswitch:
   * WEEKLY_SUMMARY_ENABLED=false in .env. Also stays off (without crashing
   * the bot) when GEMINI_API_KEY is missing.
   */
  private startWeeklySummaryScheduler(): void {
    if (process.env.WEEKLY_SUMMARY_ENABLED === "false") {
      this.logger.warn(
        "Weekly summary disabled (WEEKLY_SUMMARY_ENABLED=false) — scheduler not started",
      );
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        "GEMINI_API_KEY is not set — weekly summary scheduler not started",
      );
      return;
    }

    new WeeklySummaryScheduler(
      new SummaryService({ apiKey, model: process.env.GEMINI_MODEL }),
    ).start();
  }

  // ---------------------------------------------------------------------------
  // WhatsApp
  // ---------------------------------------------------------------------------

  private async initializeWhatsApp(): Promise<void> {
    this.logger.info("Initializing WhatsApp client...");
    await whatsappClient.init();
  }
}

// ----------------------------------------------------------------------------
// BOOTSTRAP FUNCTION
// ----------------------------------------------------------------------------

export async function bootstrap(): Promise<void> {
  logger.info("Initializing WhatsApp client...");
  const app = new Application();
  await app.initialize();
}
