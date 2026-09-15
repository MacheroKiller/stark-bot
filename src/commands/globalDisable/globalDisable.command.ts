import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GlobalCommandConfigService } from "../../database/services/globalCommandConfig.service";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GlobalDisableCommand implements CommandHandler {
  command = Commands.GLOBALDISABLE;
  description =
    "Deshabilita un comando globalmente, en todos los grupos (OWNER)";
  requiresOwner = true;

  private readonly configService = new GlobalCommandConfigService();

  async execute(
    message: string,
    groupSender: string,
    userSender: string,
  ): Promise<void> {
    const [, targetCommand, ...reasonParts] = message.trim().split(/\s+/);

    if (!targetCommand) {
      await sendMessageToGroup(
        groupSender,
        "Uso: /globaldisable <comando> [razón]",
      );
      return;
    }

    await this.configService.disable(
      targetCommand,
      userSender,
      reasonParts.join(" ") || undefined,
    );
    await sendMessageToGroup(
      groupSender,
      `${targetCommand} deshabilitado globalmente.`,
    );
  }
}
