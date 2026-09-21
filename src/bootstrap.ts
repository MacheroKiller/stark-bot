import { handlers } from "./commands/command.registry";
import { whatsappClient } from "./core/whatsapp/client";
import { initDatabase } from "./database/database.bootstrap";
import { GlobalCommandConfigService } from "./database/services/globalCommandConfig.service";
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
    await this.initializeWhatsApp();

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
