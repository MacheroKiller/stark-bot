import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GroupService } from "../../database/services/group.service";
import { handlers } from "../command.registry";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class GroupConfigCommand implements CommandHandler {
  command = Commands.GROUPCONFIG;
  description = "Configures a command for a specific group (OWNER)";
  requiresOwner = true;

  private readonly groupService = new GroupService();

  // ---
  // Command execution
  // ---

  async execute(message: string, groupSender: string): Promise<void> {
    const [, targetGroupJid, targetCommand, action, adminFlag] = message
      .trim()
      .split(/\s+/);

    if (!targetGroupJid || !targetCommand || !action) {
      await sendMessageToGroup(
        groupSender,
        "Usage: /groupconfig <groupJid> <command> <enable|disable> [requireAdmin|public]",
      );
      return;
    }

    // ---
    // Command lookup and validation
    // ---

    const targetHandler = handlers.find((h) => h.command === targetCommand);
    if (!targetHandler) {
      await sendMessageToGroup(
        groupSender,
        `Unknown command: ${targetCommand}`,
      );
      return;
    }

    if (targetHandler.locked && adminFlag) {
      await sendMessageToGroup(
        groupSender,
        `${targetCommand} is locked — its access level cannot be reconfigured.`,
      );
      return;
    }

    // ---
    // Group command configuration
    // ---

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
      `Configuration updated for ${targetCommand} in ${targetGroupJid}.`,
    );
  }
}
