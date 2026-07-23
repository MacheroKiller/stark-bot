import type { proto } from "baileys";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { removeLidSuffix } from "../../shared/utils/jid";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class FindCommand implements CommandHandler {
  command = Commands.FIND;
  description = "Returns the details of the user";
  private readonly userService = new UserService();

  async execute(
    _: string,
    groupSender: string,
    userSender: string,
    msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const mentionedJid =
      msgObj?.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const groupJid = groupSender;
    const targetJid = mentionedJid?.[0] ?? userSender;

    const user = await this.userService.findUser(groupJid, targetJid);

    if (!user) {
      await sendMessageToGroup(groupJid, `User not found`);
      return;
    }

    const position = await this.userService.findPosition(user);

    await sendMessageToGroup(
      groupJid,
      `${position}. @${removeLidSuffix(user.whatsappId)} has ${user.totalMessagesSent} messages sent`,
      [user.whatsappId],
    );
    return;
  }
}
