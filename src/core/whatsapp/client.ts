import makeWASocket, {
  Browsers,
  DEFAULT_CONNECTION_CONFIG,
  delay,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "baileys";
import logger from "../../shared/utils/logger";
import * as path from "path";
import { mkdir } from "fs/promises";
import pino from "pino";
import { registerConnectionEvents } from "./handlers/connection.handler";
import { MessageUpsertEvents } from "./handlers/upsert.handler";

/**
 * Manages WhatsApp client session using Baileys and multi-file auth state.
 * Handles socket creation, reconnection, and event setup.
 */
export class WhatsAppClient {
  private sock!: WASocket;
  private readonly authFolder: string;
  private pairingRequested = { value: false };

  constructor() {
    const sessionId = process.env.WHATSAPP_SESSION_ID || "stark-session";
    this.authFolder = path.join("auth", sessionId);

    this.createAuthFolder().catch((err) => {
      logger.error("❌ Error creating auth folder: " + err);
    });
  }

  async createAuthFolder(): Promise<void> {
    await mkdir(this.authFolder, { recursive: true }).catch(() => {});
  }

  async init(): Promise<void> {
    logger.info("Starting WhatsApp client...");
    await this.createSocket();
  }

  async cleanSocket(): Promise<void> {
    logger.info("WhatsApp client socket cleaned.");
    this.sock?.ev.removeAllListeners("creds.update");
    this.sock?.ev.removeAllListeners("connection.update");
    this.sock?.ev.removeAllListeners("messages.upsert");
    this.sock = null as any; // Clear the socket reference
    logger.info("WhatsApp client socket cleared.");
  }

  private async createSocket(): Promise<void> {
    if (this.sock) {
      await this.cleanSocket();
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    await this.cleanSocket();

    this.sock = makeWASocket({
      version,
      waWebSocketUrl: DEFAULT_CONNECTION_CONFIG.waWebSocketUrl,
      auth: state,
      browser: Browsers.macOS("Desktop"),
      //printQRInTerminal: true,
      syncFullHistory: false,
      logger: pino({ level: "warn" }),
    });

    this.sock.ev.on("creds.update", saveCreds);
    registerConnectionEvents(
      this.sock,
      () => this.reconnect(),
      this.pairingRequested,
    );
    MessageUpsertEvents(this.sock);
  }

  async reconnect(): Promise<void> {
    logger.warn("Attempting to reconnect WhatsApp socket...");
    try {
      await delay(2000);
      await this.createSocket();
    } catch (err) {
      logger.error("❌ Error during reconnection: " + err);
    }
  }

  getSocket(): WASocket {
    if (!this.sock) {
      throw new Error("WhatsApp client not initialized");
    }
    return this.sock;
  }
}

export const whatsappClient = new WhatsAppClient();
