import { Boom } from "@hapi/boom";
import { DisconnectReason, type WASocket } from "baileys";
import logger from "../../../shared/utils/logger";
import QRCode from "qrcode";

/**
 * Registers connection-related events for the WhatsApp socket.
 * Manages QR code handling, reconnections, and session persistence.
 */
export function registerConnectionEvents(
  sock: WASocket,
  onReconnect: () => void,
  pairingRequested: { value: boolean },
) {
  sock.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        pairingRequested.value = true;
        // Pairing code for Web clients
        // const phoneNumber = process.env.BOT_NUMBER;
        // if (!phoneNumber) {
        //   logger.error("No phone number added!");
        //   return;
        // }
        // const code = await sock.requestPairingCode(phoneNumber);
        // logger.info(`Phone number: ${phoneNumber}`);
        // logger.info(`Pairing code: ${code}`);

        console.log(await QRCode.toString(qr, { type: "terminal" }));
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.warn("Connection closed", {
          statusCode,
          error: lastDisconnect?.error?.message,
        });
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.warn("Connection closed. Reconnecting: " + shouldReconnect);

        if (shouldReconnect) {
          onReconnect();
        } else {
          logger.error("Logged out.");
        }
      } else if (connection === "open") {
        logger.info("✅ WhatsApp connection established!");
      }
    },
  );
}
