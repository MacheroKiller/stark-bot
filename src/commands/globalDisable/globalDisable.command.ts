import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GlobalCommandConfigService } from "../../database/services/globalCommandConfig.service";
import { handlers } from "../command.registry";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GlobalDisableCommand implements CommandHandler {
  command = Commands.GLOBALDISABLE;
  description = "Disables a command globally across all groups (OWNER)";
  requiresOwner = true;

  private readonly configService = new GlobalCommandConfigService();

  // ---
  // Command execution
  // ---

  async execute(
    message: string,
    groupSender: string,
    userSender: string,
  ): Promise<void> {
    const [, targetCommand, ...reasonParts] = message.trim().split(/\s+/);

    if (!targetCommand) {
      await sendMessageToGroup(
        groupSender,
        "Usage: /globaldisable <command> [reason]",
      );
      return;
    }

    // ---
    // Command lookup and validation
    // ---

    const handler = handlers.find((h) => h.command === targetCommand);
    if (!handler) {
      await sendMessageToGroup(
        groupSender,
        `Unknown command: ${targetCommand}. Did you mean /${targetCommand.replace(/^\//, "")}?`,
      );
      return;
    }

    // ---
    // Global command configuration
    // ---

    await this.configService.disable(
      handler.command,
      userSender,
      reasonParts.join(" ") || undefined,
    );

    await sendMessageToGroup(
      groupSender,
      `${handler.command} disabled globally.`,
    );
  }
}
