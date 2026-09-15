import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GlobalCommandConfigService } from "../../database/services/globalCommandConfig.service";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GlobalEnableCommand implements CommandHandler {
  command = Commands.GLOBALENABLE;
  description = "Habilita un comando globalmente, en todos los grupos (OWNER)";
  requiresOwner = true;

  private readonly configService = new GlobalCommandConfigService();

  async execute(message: string, groupSender: string): Promise<void> {
    const [, targetCommand] = message.trim().split(/\s+/);

    if (!targetCommand) {
      await sendMessageToGroup(
        groupSender,
        "Uso: /globalenable <comando> [razón]",
      );
      return;
    }

    await this.configService.enable(targetCommand);
    await sendMessageToGroup(
      groupSender,
      `${targetCommand} habilitado globalmente.`,
    );
  }
}
