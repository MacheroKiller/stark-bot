import { type WASocket } from "baileys";
import { sendMessageToGroup } from "../send-message";
import logger from "../../../shared/utils/logger";
import { whatsappClient } from "../client";
import { handleCommand } from "../../../commands/handle-command";

/**
 * Listens for incoming WhatsApp messages.
 * Handles commands, gratitude messages, and auto-replies.
 */
export function MessageUpsertEvents(sock: WASocket) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key?.fromMe) return;

    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

    const trimmedText = text.trim();
    const lowerText = trimmedText.toLowerCase();
    const sender = msg.key.remoteJid || msg.key.participant || "unknown";

    const isFromGroup = sender.includes("@g.us");
    const isFromUser = sender.includes("@s.whatsapp.net");
    const isCommand = trimmedText.startsWith("/");

    logger.info(`Message from ${sender}: ${text}`);

    if (isCommand) {
      logger.info("Command detected!");
      await handleCommand(trimmedText, msg, isFromGroup, isFromUser);
    }
  });
}
