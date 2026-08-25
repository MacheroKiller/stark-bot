import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { removeLidSuffix } from "../../shared/utils/jid";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class FindTopCommand implements CommandHandler {
  command = Commands.FINDTOP;
  description = "Returns the user at the specified ranking position.";
  requiresAdmin?: boolean = false;

  private readonly userService = new UserService();

  async execute(
    message: string,
    groupSender: string,
    __: string,
  ): Promise<void> {
    const value = message?.trim().split(" ");

    if (!value) return;

    const position = value[1];

    if (!position) {
      await sendMessageToGroup(groupSender, "Position is missing");
      return;
    }

    if (!/^\d+$/.test(position)) {
      await sendMessageToGroup(groupSender, "Only whole numbers are allowed");
      return;
    }

    const user = await this.userService.findUserByPosition(
      groupSender,
      Number(position),
    );

    if (!user) {
      await sendMessageToGroup(groupSender, "No user found at that position.");
      return;
    }

    await sendMessageToGroup(
      groupSender,
      `${position}. @${removeLidSuffix(user.whatsappId)} has ${user.totalMessagesSent ?? "0"} messages sent`,
      [user.whatsappId],
    );
    return;
  }
}
