import type { proto } from "baileys";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";
import { removeLidSuffix } from "../../shared/utils/jid";
import type { User } from "../../database/interfaces/user.interface";

export class TopCommand implements CommandHandler {
  command = Commands.TOP;
  description = "Returns the group's top message senders.";
  private readonly userService = new UserService();

  async execute(_: string, groupSender: string): Promise<void> {
    const whatsappId = groupSender;

    const top = await this.userService.getTopMessageSenders(whatsappId);

    const topFilter = top.map((user) => ({
      ...user,
      whatsappId: removeLidSuffix(user.whatsappId),
    }));

    const messageToSent = this.buildMessage(topFilter);

    await sendMessageToGroup(
      whatsappId,
      messageToSent,
      top.map((user) => user.whatsappId),
    );
  }

  buildMessage(topFilter: User[]): string {
    const header = "*_TOP SENDERS_*\n";

    const lines = topFilter
      .map(
        (user, index) =>
          `${index + 1}. @${user.whatsappId} has ${user.totalMessagesSent} messages sent`,
      )
      .join("\n");

    return `${header}\n${lines}`;
  }
}
