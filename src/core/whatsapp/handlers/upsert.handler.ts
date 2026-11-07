import { type WASocket, type proto } from "baileys";
import {
  HandleCommand,
  type ContextMessageDTO,
} from "../../../commands/handle-command";
import type { Group } from "../../../database/interfaces/group.interface";
import { GroupService } from "../../../database/services/GroupService/group.service";
import { extractChatJid, isGroupJid } from "../../../shared/utils/jid/jid";
import logger from "../../../shared/utils/logger/logger";
import { UserService } from "../../../database/services/UserService/user.service";
import { getOwnerJids, isOwner } from "../../../shared/utils/owner/owner";
import { sendMessageToGroup } from "../send-message";
import { isGroupAllowedInCurrentEnv } from "../../../shared/utils/env/env";
import { GroupSummaryConfigService } from "../../../database/services/GroupSummaryConfigService/groupSummaryConfig.service";
import { MessageHistoryService } from "../../../database/services/MessageHistoryService/messageHistory.service";

/**
 * Listens for incoming WhatsApp messages.
 * Handles commands, gratitude messages, and auto-replies.
 */
export function MessageUpsertEvents(sock: WASocket) {
  // Services - Classes
  const groupService = new GroupService();
  const handleCommand = new HandleCommand();
  const userService = new UserService();
  const groupSummaryConfigService = new GroupSummaryConfigService();
  const messageHistoryService = new MessageHistoryService();

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (!msg?.message || msg.key?.fromMe) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          "";

        const trimmedText = text.trim();
        const sender = extractChatJid(msg);

        const isFromGroup = isGroupJid(sender);
        const isCommand = trimmedText.startsWith("/");

        const context = handleCommand.getContext(msg);
        if (!context) continue;

        if (isFromGroup && !isGroupAllowedInCurrentEnv(context.groupJid))
          continue;

        if (isCommand && !isFromGroup && isOwner(context.senderJid)) {
          await handleCommand.handle(trimmedText, context, msg);
          continue;
        }

        const group = await groupService.findByWhatsappId(context.groupJid);
        if (!group) {
          logger.warn(`Grupo no registrado: ${context.groupJid}`);
          continue;
        }

        if (group.status !== "approved") {
          if (isCommand && group.status === "pending") {
            await sendMessageToGroup(
              context.groupJid,
              "This groups isn't authorized.",
            );
          }
          continue;
        }

        if (isFromGroup && !group.isAnnouncementOnly) {
          await countMessage(group, context, userService);
          await recordMessageForSummary(
            group,
            context,
            extractSummaryText(msg, trimmedText),
            msg,
            groupSummaryConfigService,
            messageHistoryService,
          );
        }
        if (isCommand) await handleCommand.handle(trimmedText, context, msg);
      } catch (error) {
        logger.error("Error procesando mensaje individual en messages.upsert", {
          error,
        });
      }
    }
  });

  sock.ev.on("groups.upsert", async (groups) => {
    for (const groupInfo of groups) {
      try {
        if (!groupInfo) {
          logger.warn(`Grupo no registrado: ${groupInfo}`);
          continue;
        }

        const existing = await groupService.findByWhatsappId(groupInfo.id);

        const groupBuild: Group = {
          whatsappId: groupInfo.id,
          name: groupInfo.subject,
          status: "pending",
          requestedAt: new Date(),
        };

        await groupService.findOrCreate(groupBuild); // Registrar nuevo
        logger.info(
          `Grupo sincronizado: ${groupBuild.whatsappId} (${groupBuild.name})`,
        );

        if (!existing) {
          await notifyOwnersOfPendingGroup(
            groupBuild,
            groupInfo.participants?.length ?? 0,
          );
        }

        const adminUpdates = (groupInfo.participants ?? []).map((p) => ({
          whatsappId: p.id,
          isAdmin: p.admin != null, // Baileys: "admin" | "superadmin" | undefined
        }));
        await userService.setAdminStatus(groupInfo.id, adminUpdates);
        logger.info(`Admins sincronizados...`);
      } catch (error) {
        logger.error("Error procesando group.upsert", { error });
      }
    }
  });

  sock.ev.on(
    "group-participants.update",
    async ({ id: groupJid, participants, action }) => {
      try {
        const idUserList = participants.map((whatssapId) => whatssapId.id);

        if (action === "promote" || action === "demote") {
          const isAdmin = action === "promote";
          await userService.setAdminStatus(
            groupJid,
            idUserList.map((whatsappId) => ({ whatsappId, isAdmin })),
          );
          logger.info(
            `Usuarios sincronizados en ${groupJid} (${participants.length}): ${action}`,
          );
          return;
        }

        if (action === "remove") {
          await userService.deleteUsers(groupJid, idUserList);
          logger.info(
            `Usuarios eliminados de la BD en ${groupJid} (${participants.length})`,
          );
          return;
        }
      } catch (error) {
        logger.error("Error procesando group-participants.update", { error });
      }
    },
  );
}

async function notifyOwnersOfPendingGroup(
  group: Group,
  participantCount: number,
) {
  const text =
    `Nuevo grupo pendiente de aprobación:\n\n` +
    `*${group.name}*\n` +
    `JID: ${group.whatsappId}\n` +
    `Participantes: ${participantCount}\n\n` +
    `Para aprobar: /approve ${group.whatsappId}\n` +
    `Para rechazar: /reject ${group.whatsappId}`;

  for (const ownerJid of getOwnerJids()) {
    await sendMessageToGroup(ownerJid, text);
  }
}
async function countMessage(
  group: Group,
  context: ContextMessageDTO,
  userService: UserService,
) {
  const isNewUser = await userService.findOrCreateAndIncrement(
    context.senderJid,
    group.whatsappId,
  );

  if (isNewUser?.totalMessagesSent === 1)
    logger.info(`Nuevo participante agregado: ${context.senderJid}`);
}

/**
 * Text to store in the weekly-summary log for a message.
 *
 * Plain text is returned as is. For media messages the caption is the only
 * text there is, so it is kept and prefixed with a marker ("[imagen]",
 * "[video]", "[documento]") that tells the model a file came with it — e.g.
 * "[imagen] Consignación hecha!" is a payment proof. A media message with no
 * caption is still logged as just the marker, since the file itself is the
 * evidence.
 *
 * Only used for the summary log: command detection and message counting keep
 * using the original text, so a caption starting with "/" is never treated
 * as a command.
 */
function extractSummaryText(
  msg: proto.IWebMessageInfo,
  plainText: string,
): string {
  if (plainText) return plainText;

  const message = msg.message;
  if (!message) return "";

  const media: Array<[string, string | null | undefined, boolean]> = [
    ["[imagen]", message.imageMessage?.caption, !!message.imageMessage],
    ["[video]", message.videoMessage?.caption, !!message.videoMessage],
    [
      "[documento]",
      message.documentMessage?.caption,
      !!message.documentMessage,
    ],
  ];

  for (const [marker, caption, present] of media) {
    if (!present) continue;
    const trimmedCaption = caption?.trim();
    return trimmedCaption ? `${marker} ${trimmedCaption}` : marker;
  }

  return "";
}

/**
 * Logs the message text (and the sender's display name) for the group's
 * weekly summary — only for groups that opted in with /setsummaryprompt.
 * The opt-in check is an in-memory Set lookup, so for every other group this
 * costs nothing and never touches Mongo. Counting and commands behave
 * exactly as before regardless of this.
 *
 * A failure here must never break message processing, so it is contained.
 */
async function recordMessageForSummary(
  group: Group,
  context: ContextMessageDTO,
  text: string,
  msg: proto.IWebMessageInfo,
  groupSummaryConfigService: GroupSummaryConfigService,
  messageHistoryService: MessageHistoryService,
) {
  if (!groupSummaryConfigService.isEnabled(group.whatsappId)) return;

  try {
    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000)
      : new Date();

    await messageHistoryService.record(
      group.whatsappId,
      context.senderJid,
      msg.pushName,
      text,
      timestamp,
    );
  } catch (error) {
    logger.error("Error guardando mensaje para el informe semanal", { error });
  }
}
