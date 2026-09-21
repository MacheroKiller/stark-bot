import type { proto } from "baileys";
import type { CommandHandler } from "../interfaces/command.interface";
import { Commands } from "../enums/commands.enum";
import { GroupService } from "../../database/services/group.service";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";

export class ApproveCommand implements CommandHandler {
  command = Commands.APPROVE;
  description = "Approves a pending group registration (OWNER)";
  requiresOwner = true;

  private readonly groupService = new GroupService();

  // ---
  // Command execution
  // ---

  async execute(
    message: string,
    groupSender: string,
    userSender: string,
    _msgObj?: proto.IWebMessageInfo,
  ): Promise<void> {
    const [, targetGroupJid] = message.trim().split(/\s+/);

    if (!targetGroupJid) {
      await sendMessageToGroup(groupSender, "Usage: /approve <groupJid>");
      return;
    }

    // ---
    // Target group lookup
    // ---

    const group = await this.groupService.findByWhatsappId(targetGroupJid);
    if (!group) {
      await sendMessageToGroup(
        groupSender,
        `No group found with this JID: ${targetGroupJid}`,
      );
      return;
    }

    if (group.status === "approved") {
      await sendMessageToGroup(groupSender, "This group is already approved.");
      return;
    }

    // ---
    // Group approval
    // ---

    await this.groupService.updateStatus(
      targetGroupJid,
      "approved",
      userSender,
    );

    await sendMessageToGroup(
      groupSender,
      `Group approved: ${group.name} (${targetGroupJid})`,
    );
    await sendMessageToGroup(
      targetGroupJid,
      "Hello! This group has been approved. Use /help to see the available commands.",
    );
  }
}
