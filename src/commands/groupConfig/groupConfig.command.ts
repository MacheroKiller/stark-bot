import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GroupService } from "../../database/services/group.service";
import { handlers } from "../command.registry";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GroupConfigCommand implements CommandHandler {
  command = Commands.GROUPCONFIG;
  description = "Configura un comando para un grupo específico (OWNER)";
  requiresOwner = true;

  private readonly groupService = new GroupService();

  async execute(message: string, groupSender: string): Promise<void> {
    const [, targetGroupJid, targetCommand, action, adminFlag] = message
      .trim()
      .split(/\s+/);

    if (!targetGroupJid || !targetCommand || !action) {
      await sendMessageToGroup(
        groupSender,
        "Uso: /groupconfig <groupJid> <comando> <enable|disable> [requiresAdmin|public]",
      );
      return;
    }

    const targetHandler = handlers.find((h) => h.command === targetCommand);
    if (!targetHandler) {
      await sendMessageToGroup(
        groupSender,
        `Comando desconocido: ${targetCommand}`,
      );
      return;
    }

    if (targetHandler.locked && adminFlag) {
      await sendMessageToGroup(
        groupSender,
        `${targetCommand} está bloqueado — su nivel de acceso no se puede reconfigurar.`,
      );
      return;
    }

    await this.groupService.setCommandOverride(targetGroupJid, targetCommand, {
      enabled: action === "enable",
      requiresAdmin:
        adminFlag === "requiresAdmin"
          ? true
          : adminFlag === "public"
            ? false
            : undefined,
    });

    await sendMessageToGroup(
      groupSender,
      `Configuración actualizada para ${targetCommand} en ${targetGroupJid}.`,
    );
  }
}
