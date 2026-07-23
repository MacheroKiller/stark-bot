import type { proto } from "baileys";
import { extractSenderJid } from "../shared/utils/jid";
import logger from "../shared/utils/logger";
import { handlers } from "./command.registry";

export interface ContextMessageDTO {
  senderJid: string;
  groupJid: string;
}

export class HandleCommand {
  private readonly handlerMap = new Map(handlers.map((h) => [h.command, h]));

  async handle(
    message: string,
    context: ContextMessageDTO,
    msgObj: proto.IWebMessageInfo,
  ) {
    const command = this.extractCommand(message);
    if (!command) return;
    const handler = this.findHandler(command);
    if (!handler) return;
    await handler.execute(message, context.groupJid, context.senderJid, msgObj);
  }
  private extractCommand(message: string): string | null {
    const [commandRaw] = message.trim().split(/\s+/);

    return commandRaw?.toLowerCase() ?? null;
  }

  private findHandler(command: string) {
    return this.handlerMap.get(command);
  }
  getContext(msgObj: proto.IWebMessageInfo): ContextMessageDTO | null {
    const groupJid = msgObj?.key?.remoteJid;
    const senderJid = extractSenderJid(msgObj);

    if (!senderJid) {
      logger.error("No se pudo obtener el número del remitente.");
      return null;
    }

    if (!groupJid) {
      logger.error("No se pudo obtener el número del grupo.");
      return null;
    }

    return { senderJid, groupJid };
  }
}
