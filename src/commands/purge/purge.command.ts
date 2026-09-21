import { delay } from "baileys";
import { whatsappClient } from "../../core/whatsapp/client";
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
import logger from "../../shared/utils/logger/logger";
const PURGE_MESSAGE_THRESHOLD = 5;
const PURGE_BATCH_SIZE = 20;
const PURGE_BATCH_DELAY_MS = 3000;
const PURGE_CONFIRM_TTL_MS = 2 * 60 * 1000;
const PURGE_COOLDOWN_AFTER_RESET_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingPurge {
  whatsappIds: string[];
  initiatedBy: string;
}

export class PurgeCommand implements CommandHandler {
  command = Commands.PURGE;
  description = `Removes users with fewer than ${PURGE_MESSAGE_THRESHOLD} messages sent`;
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

    if (subcommand === "confirm") {
      await this.executeConfirm(groupJid, userSender);
      return;
    }

    await this.executeDryRun(groupJid, userSender);
  }

  private async executeDryRun(
    groupJid: string,
    userSender: string,
  ): Promise<void> {
    const group = await this.groupService.findByWhatsappId(groupJid);

    if (group?.lastResetAt) {
      const cooldownEnds =
        group.lastResetAt.getTime() + PURGE_COOLDOWN_AFTER_RESET_MS;

      if (Date.now() < cooldownEnds) {
        await sendMessageToGroup(
          userSender,
          `This group reset its counters recently. /purge will be available again on ${new Date(cooldownEnds).toLocaleString()}.`,
        );
        return;
      }
    }

    const inactiveUsers = await this.userService.findInactiveUsers(
      groupJid,
      PURGE_MESSAGE_THRESHOLD,
    );

    if (inactiveUsers.length === 0) {
      await sendMessageToGroup(
        userSender,
        "There are no inactive users to purge.",
      );
      return;
    }

    const pending: PendingPurge = {
      whatsappIds: inactiveUsers.map((u) => u.whatsappId),
      initiatedBy: userSender,
    };

    setPendingConfirmation(`purge:${groupJid}`, pending, PURGE_CONFIRM_TTL_MS);

    await sendMessageToGroup(
      userSender,
      `${inactiveUsers.length} users would be removed from ${group?.name} (fewer than ${PURGE_MESSAGE_THRESHOLD} messages). Run /purge confirm in the group within 2 minutes to proceed.`,
    );
  }

  private async executeConfirm(
    groupJid: string,
    userSender: string,
  ): Promise<void> {
    const pending = getPendingConfirmation<PendingPurge>(`purge:${groupJid}`);

    if (!pending) {
      await sendMessageToGroup(
        userSender,
        "There's no pending purge to confirm. Run /purge first.",
      );
      return;
    }

    clearPendingConfirmation(`purge:${groupJid}`);

    await sendMessageToGroup(
      userSender,
      `Purging ${pending.whatsappIds.length} inactive users...`,
    );

    const removed: string[] = [];
    const failed: string[] = [];

    for (const batch of this.chunk(pending.whatsappIds, PURGE_BATCH_SIZE)) {
      const { ok, errors } = await this.removeParticipants(groupJid, batch);
      removed.push(...ok);
      failed.push(...errors);
      await delay(PURGE_BATCH_DELAY_MS);
    }

    const isSameAdmin = pending.initiatedBy === userSender;
    const confirmedByNote = isSameAdmin
      ? ""
      : ` (confirmed by @${removeLidSuffix(userSender)})`;

    await sendMessageToGroup(
      userSender,
      `*💀 Purge completed for ${groupJid}:* ${removed.length} removed, ${failed.length} failed.${confirmedByNote}`,
      isSameAdmin ? [] : [userSender],
    );

    // Si quien confirmó no es quien inició el /purge, avisarle al que lo inició
    // para evitar dudas sobre quién ejecutó la eliminación real.
    if (!isSameAdmin) {
      await sendMessageToGroup(
        pending.initiatedBy,
        `@${removeLidSuffix(userSender)} confirmed and executed the purge you started for ${groupJid}. ${removed.length} removed, ${failed.length} failed.`,
        [userSender],
      );
    }
  }

  private chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  }

  private async removeParticipants(
    groupJid: string,
    jids: string[],
  ): Promise<{ ok: string[]; errors: string[] }> {
    try {
      const results = await whatsappClient
        .getSocket()
        .groupParticipantsUpdate(groupJid, jids, "remove");

      const ok = results
        .filter(
          (r): r is typeof r & { jid: string } =>
            r.status === "200" && r.jid !== undefined,
        )
        .map((r) => r.jid);

      const errors = results
        .filter(
          (r): r is typeof r & { jid: string } =>
            r.status !== "200" && r.jid !== undefined,
        )
        .map((r) => r.jid);

      return { ok, errors };
    } catch (error) {
      logger.error("Error purging user batch", { error, groupJid, jids });
      return { ok: [], errors: jids };
    }
  }
}
