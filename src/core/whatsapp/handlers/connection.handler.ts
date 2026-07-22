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
) {
  sock.ev.on(
    "connection.update",
    async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log(
          await QRCode.toString(qr, {
            type: "terminal",
            margin: 1,
          }),
        );

        await QRCode.toFile("./auth/qr.png", qr);
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
