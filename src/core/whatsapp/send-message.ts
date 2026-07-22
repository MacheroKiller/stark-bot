import { type WAMessage, type WASocket } from "baileys";
import logger from "../../shared/utils/logger";
import { whatsappClient } from "./client";

/**
 * Manages WhatsApp message sending and socket registration.
 * Handles fallback for storing unsent messages as pending.
 */

let socket: WASocket | null = null;

/**
 * Simulates typing before sending
 */
async function simulateTyping(jid: string, duration = 2000) {
  if (!socket) return;
  await socket.presenceSubscribe(jid);
  await socket.sendPresenceUpdate("composing", jid);
  await new Promise((r) => setTimeout(r, duration));
  await socket.sendPresenceUpdate("paused", jid);
}

/**
 * Sends a message to a WhatsApp group.
 * Stores the message as pending if delivery fails and it's not already a retry.
 */
export async function sendMessageToGroup(
  whatsappId: string,
  message: string,
  mention?: string[],
  quoted?: WAMessage,
) {
  socket = whatsappClient.getSocket();
  if (!socket) {
    logger.error("❌ WhatsApp socket not initialized");
    return;
  }

  if (!whatsappId || !message) {
    logger.error("❌ Invalid whatsappId or message");
    return;
  }

  try {
    // Simular "escribiendo"
    await simulateTyping(whatsappId, 3000);

    await socket.sendMessage(
      whatsappId,
      { text: message, mentions: mention ?? [] },
      { quoted },
    );
  } catch (err: any) {
    logger.error(`❌ Failed to send message: ${err?.message || err}`);
  }
}
