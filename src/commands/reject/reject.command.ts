import type { proto } from "baileys";
import type { CommandHandler } from "../interfaces/command.interface";
import { Commands } from "../enums/commands.enum";
import { GroupService } from "../../database/services/group.service";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";

export class RejectCommand implements CommandHandler {
  command = Commands.REJECT;
  description = "Rechaza un grupo pendiente de registro (OWNER)";
  requiresOwner = true;

  private readonly groupService = new GroupService();

  async execute(
    message: string,
    groupSender: string,
    userSender: string,
    _msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const [, targetGroupJid] = message.trim().split(/\s+/);

    if (!targetGroupJid) {
      await sendMessageToGroup(groupSender, "Uso: /reject <groupJid>");
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

    await this.groupService.updateStatus(
      targetGroupJid,
      "rejected",
      userSender,
    );
    await sendMessageToGroup(
      groupSender,
      `Grupo rechazado: ${group.name} (${targetGroupJid})`,
    );
  }
}
