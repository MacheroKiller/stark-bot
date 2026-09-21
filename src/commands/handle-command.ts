import type { proto } from "baileys";
import { extractSenderJid } from "../shared/utils/jid/jid";
import logger from "../shared/utils/logger/logger";
import { handlers } from "./command.registry";
import { sendMessageToGroup } from "../core/whatsapp/send-message";
import { UserService } from "../database/services/user.service";
import { isOwner } from "../shared/utils/owner/owner";
import { GlobalCommandConfigService } from "../database/services/globalCommandConfig.service";
import { GroupService } from "../database/services/group.service";
import { Commands } from "./enums/commands.enum";

const GLOBAL_DISABLE_EXEMPT: string[] = [
  Commands.APPROVE,
  Commands.REJECT,
  Commands.GROUPCONFIG,
  Commands.GLOBALDISABLE,
  Commands.GLOBALENABLE,
];

export interface ContextMessageDTO {
  senderJid: string;
  groupJid: string;
}

export class HandleCommand {
  constructor(
    private readonly userService: UserService = new UserService(),
    private readonly groupService: GroupService = new GroupService(),
    private readonly globalCommandConfigService: GlobalCommandConfigService = new GlobalCommandConfigService(),
  ) { }
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

    if (!GLOBAL_DISABLE_EXEMPT.includes(handler.command)) {
      const globalConfig = await this.globalCommandConfigService.findByCommand(
        handler.command,
      );
      if (globalConfig && !globalConfig.enabled) return;
    }

    if (handler.requiresOwner) {
      if (!isOwner(context.senderJid)) return;
      await handler.execute(
        message,
        context.groupJid,
        context.senderJid,
        msgObj,
      );
      return;
    }

    const group = await this.groupService.findByWhatsappId(context.groupJid);
    const override = group?.commandOverrides?.[handler.command];

    if (override && !override.enabled) return;

    const requiresAdmin = handler.locked
      ? (handler.requiresAdmin ?? false)
      : (override?.requiresAdmin ?? handler.requiresAdmin ?? false);

    if (requiresAdmin) {
      const user = await this.userService.findUser(
        context.groupJid,
        context.senderJid,
      );
      if (!user?.isAdmin) {
        await sendMessageToGroup(
          context.groupJid,
          "Este comando es solo para administradores.",
        );
        return;
      }
    }

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
