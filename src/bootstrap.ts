import { whatsappClient } from "./core/whatsapp/client";
import { initDatabase } from "./database/database.bootstrap";
import type { ILogger } from "./shared/utils/logger";
import logger, { createLogger } from "./shared/utils/logger";

export class Application {
  private readonly logger: ILogger;

  constructor() {
    this.logger = createLogger();
  }

  async initialize(): Promise<void> {
    this.logger.info("🚀 Initializing Stark Bot...");

    await initDatabase(this.logger);
    await this.initializeWhatsApp();

    this.logger.info("Stark Bot initialized successfully");
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
