import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import { GroupService } from "../../database/services/group.service";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";
import {
  clearPendingConfirmation,
  getPendingConfirmation,
  setPendingConfirmation,
} from "../../shared/utils/pendingConfirmationStore/pendingConfirmationStore";
import { removeLidSuffix } from "../../shared/utils/jid/jid";

const RESET_CONFIRM_TTL_MS = 2 * 60 * 1000;

interface PendingReset {
  initiatedBy: string;
}

export class ResetCommand implements CommandHandler {
  command = Commands.RESET;
  description = "Resets the message counter for every user in the group.";
  requiresAdmin = true;
  locked = true;

  private readonly userService = new UserService();
  private readonly groupService = new GroupService();

  async execute(
    message: string,
    groupJid: string,
    userSender: string,
  ): Promise<void> {
    const [, subcommand] = message.trim().split(/\s+/);

    const group = await this.groupService.findByWhatsappId(groupJid);

    if (subcommand === "confirm") {
      await this.executeConfirm(groupJid, userSender);
      return;
    }

    const pending: PendingReset = { initiatedBy: userSender };
    setPendingConfirmation(`reset:${groupJid}`, pending, RESET_CONFIRM_TTL_MS);

    await sendMessageToGroup(
      userSender,
      `This will reset the message counter for every user in ${group?.name}. Run /reset confirm in the group within 2 minutes to proceed.`,
    );
  }

  private async executeConfirm(
    groupJid: string,
    userSender: string,
  ): Promise<void> {
    const pending = getPendingConfirmation<PendingReset>(`reset:${groupJid}`);

    if (!pending) {
      await sendMessageToGroup(
        userSender,
        "There's no pending reset to confirm. Run /reset first.",
      );
      return;
    }

    clearPendingConfirmation(`reset:${groupJid}`);

    await this.userService.resetTotalMessagesSent(groupJid);
    await this.groupService.setLastResetAt(groupJid);

    const isSameAdmin = pending.initiatedBy === userSender;
    const confirmedByNote = isSameAdmin
      ? ""
      : ` (confirmed by @${removeLidSuffix(userSender)})`;

    await sendMessageToGroup(
      userSender,
      `Message counters reset for ${groupJid}.${confirmedByNote}`,
      isSameAdmin ? [] : [userSender],
    );

    if (!isSameAdmin) {
      await sendMessageToGroup(
        pending.initiatedBy,
        `@${removeLidSuffix(userSender)} confirmed and executed the reset you started for ${groupJid}.`,
        [userSender],
      );
    }
  }
}
