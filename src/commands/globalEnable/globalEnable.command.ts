import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GlobalCommandConfigService } from "../../database/services/globalCommandConfig.service";
import { handlers } from "../command.registry";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GlobalEnableCommand implements CommandHandler {
  command = Commands.GLOBALENABLE;
  description = "Enables a command globally across all groups (OWNER)";
  requiresOwner = true;

  private readonly configService = new GlobalCommandConfigService();

  // ---
  // Command execution
  // ---

  async execute(message: string, groupSender: string): Promise<void> {
    const [, targetCommand] = message.trim().split(/\s+/);

    if (!targetCommand) {
      await sendMessageToGroup(groupSender, "Usage: /globalenable <command>");
      return;
    }

    // ---
    // Command lookup and validation
    // ---

    const handler = handlers.find((h) => h.command === targetCommand);
    if (!handler) {
      await sendMessageToGroup(
        groupSender,
        `Unknown command: ${targetCommand}`,
      );
      return;
    }

    // ---
    // Global command configuration
    // ---

    await this.configService.enable(handler.command);
    await sendMessageToGroup(
      groupSender,
      `${handler.command} enabled globally.`,
    );
  }
}
