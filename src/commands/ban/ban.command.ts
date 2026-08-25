import type { proto } from "baileys";
import { whatsappClient } from "../../core/whatsapp/client";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { removeLidSuffix } from "../../shared/utils/jid";
import logger from "../../shared/utils/logger";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class BanCommand implements CommandHandler {
  command = Commands.BAN;

  description = "Bans a user from the group";

  requiresAdmin = true;

  private readonly userService = new UserService();

  async execute(
    _: string,
    groupJid: string,
    __: string,
    msgObj: proto.IWebMessageInfo,
  ): Promise<void> {
    const targetJid = this.getMentionedUser(msgObj);

    if (!targetJid) {
      await sendMessageToGroup(groupJid, "Mention the user you want to ban.");
      return;
    }

    const user = await this.userService.findUser(groupJid, targetJid);

    if (user?.isAdmin) {
      await sendMessageToGroup(
        groupJid,
        "You cannot ban another administrator.",
      );
      return;
    }

    const removed = await this.removeParticipant(groupJid, targetJid);

    if (!removed) {
      return;
    }

    await sendMessageToGroup(
      groupJid,
      `@${removeLidSuffix(targetJid)} was removed from the group.`,
      [targetJid],
    );
  }

  private getMentionedUser(msgObj: proto.IWebMessageInfo): string | undefined {
    return msgObj.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
  }

  private async removeParticipant(
    groupJid: string,
    targetJid: string,
  ): Promise<boolean> {
    try {
      await whatsappClient
        .getSocket()
        .groupParticipantsUpdate(groupJid, [targetJid], "remove");

      return true;
    } catch (error) {
      logger.error("Error banning user", {
        error,
        groupJid,
        targetJid,
      });

      await sendMessageToGroup(
        groupJid,
        "I am not an administrator of this group.",
      );

      return false;
    }
  }
}
