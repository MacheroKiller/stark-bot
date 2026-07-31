import type { proto } from "baileys";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { removeLidSuffix } from "../../shared/utils/jid";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";
import type { User } from "../../database/interfaces/user.interface";

export class FindCommand implements CommandHandler {
  command = Commands.FIND;
  description = "Returns the details of the user or the users";
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
    const targetJid =
      mentionedJid && mentionedJid.length > 0 ? mentionedJid : [userSender];

    const users = await this.userService.findUserList(groupJid, targetJid);

    if (!users.length) {
      await sendMessageToGroup(groupJid, "Users not found");
      return;
    }

    const whatsappIds = users.map((user) => user.whatsappId);
    const positions = await this.userService.findUserPositionList(
      groupJid,
      whatsappIds,
    );

    await sendMessageToGroup(
      groupJid,
      this.buildMessage(users, positions),
      users.map((u) => u.whatsappId),
    );
    return;
  }

  buildMessage(users: User[], positions: Map<string, number>): string {
    const lines = users
      .sort(
        (a, b) => positions.get(a.whatsappId)! - positions.get(b.whatsappId)!,
      )
      .map((user) => {
        const position = positions.get(user.whatsappId);

        return `${position}. @${removeLidSuffix(user.whatsappId)} has ${
          user.totalMessagesSent ?? 0
        } messages sent`;
      })
      .join("\n");

    return `${lines}`;
  }
}
