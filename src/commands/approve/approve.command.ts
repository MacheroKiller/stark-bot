import type { proto } from "baileys";
import type { CommandHandler } from "../interfaces/command.interface";
import { Commands } from "../enums/commands.enum";
import { GroupService } from "../../database/services/group.service";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";

export class ApproveCommand implements CommandHandler {
  command = Commands.APPROVE;
  description = "Aprueba un grupo pendiente de registro (OWNER)";
  requiresOwner = true;

  private readonly groupService = new GroupService();

  async execute(
    message: string,
    groupSender: string, // acá es el JID del chat con el OWNER (DM)
    userSender: string,
    _msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const [, targetGroupJid] = message.trim().split(/\s+/);

    if (!targetGroupJid) {
      await sendMessageToGroup(groupSender, "Uso: /approve <groupJid>");
      return;
    }

    const group = await this.groupService.findByWhatsappId(targetGroupJid);
    if (!group) {
      await sendMessageToGroup(
        groupSender,
        `No encontré un grupo con ese JID: ${targetGroupJid}`,
      );
      return;
    }

    if (group.status === "approved") {
      await sendMessageToGroup(groupSender, "Ese grupo ya estaba aprobado.");
      return;
    }

    await this.groupService.updateStatus(
      targetGroupJid,
      "approved",
      userSender,
    );

    await sendMessageToGroup(
      groupSender,
      `Grupo aprobado: ${group.name} (${targetGroupJid})`,
    );
    await sendMessageToGroup(
      targetGroupJid,
      "¡Hola! Este grupo ya fue aprobado. Usá /help para ver los comandos disponibles.",
    );
  }
}
