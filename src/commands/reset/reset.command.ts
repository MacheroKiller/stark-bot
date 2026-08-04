import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class ResetCommand implements CommandHandler {
  command = Commands.RESET;
  description = "Resets the bot's state and clears any stored data.";
  requiresAdmin?: boolean | undefined = true;
  private readonly userService = new UserService();

  async execute(_: string, groupSender: string): Promise<void> {
    await this.userService.resetTotalMessagesSent(groupSender);

    await sendMessageToGroup(
      groupSender,
      `The bot's state has been reset, and all stored data has been cleared.`,
    );
  }
}
