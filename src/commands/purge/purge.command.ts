import { delay } from "baileys";
import { whatsappClient } from "../../core/whatsapp/client";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { UserService } from "../../database/services/user.service";
import logger from "../../shared/utils/logger";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

const PURGE_MESSAGE_THRESHOLD = 5;
const PURGE_BATCH_SIZE = 20;
const PURGE_BATCH_DELAY_MS = 3000;

export class PurgeCommand implements CommandHandler {
  command = Commands.PURGE;

  description = `Removes users with fewer than ${PURGE_MESSAGE_THRESHOLD} messages sent`;

  requiresAdmin = true;

  private readonly userService = new UserService();

  async execute(_: string, groupJid: string): Promise<void> {
    const inactiveUsers = await this.userService.findInactiveUsers(
      groupJid,
      PURGE_MESSAGE_THRESHOLD,
    );

    if (inactiveUsers.length === 0) {
      await sendMessageToGroup(
        groupJid,
        "There are no inactive users to purge.",
      );
      return;
    }

    await sendMessageToGroup(
      groupJid,
      `Purging ${inactiveUsers.length} inactive users (fewer than ${PURGE_MESSAGE_THRESHOLD} messages)...`,
    );

    const removed: string[] = [];
    const failed: string[] = [];

    for (const batch of this.chunk(inactiveUsers, PURGE_BATCH_SIZE)) {
      const jids = batch.map((u) => u.whatsappId);
      const { ok, errors } = await this.removeParticipants(groupJid, jids);

      removed.push(...ok);
      failed.push(...errors);

      // Pause between batches to avoid rate limiting / spam detection
      await delay(PURGE_BATCH_DELAY_MS);
    }

    await sendMessageToGroup(
      groupJid,
      `*💀 Purge's been completed 💀:* ${removed.length} users removed, ${failed.length} failed.`,
    );
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
      logger.error("Error purging user batch", {
        error,
        groupJid,
        jids,
      });

      return { ok: [], errors: jids };
    }
  }
}
