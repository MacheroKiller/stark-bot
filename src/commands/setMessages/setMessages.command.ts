import type { proto } from "baileys";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { removeLidSuffix } from "../../shared/utils/jid/jid";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class SetMessagesCommand implements CommandHandler {
  command = Commands.SETMESSAGES;
  description = "Manually sets a user's message counter (ADMIN)";
  requiresAdmin = true;
  locked = true;

  private readonly userService = new UserService();

  async execute(
    message: string,
    groupJid: string,
    _userSender: string,
    msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const mentionedJid =
      msgObj?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const parts = message.trim().split(/\s+/);
    const value = Number(parts[parts.length - 1]);

    if (!mentionedJid || Number.isNaN(value) || value < 0) {
      await sendMessageToGroup(groupJid, "Usage: /setmessages @user <number>");
      return;
    }

    await this.userService.setTotalMessagesSent(groupJid, mentionedJid, value);
    await sendMessageToGroup(
      groupJid,
      `Set @${removeLidSuffix(mentionedJid)}'s message count to ${value}.`,
      [mentionedJid],
    );
  }
}
