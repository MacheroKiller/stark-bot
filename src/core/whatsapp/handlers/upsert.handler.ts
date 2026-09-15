import { type WASocket } from "baileys";
import {
  HandleCommand,
  type ContextMessageDTO,
} from "../../../commands/handle-command";
import type { Group } from "../../../database/interfaces/group.interface";
import { GroupService } from "../../../database/services/group.service";
import { extractChatJid, isGroupJid } from "../../../shared/utils/jid";
import logger from "../../../shared/utils/logger";
import { UserService } from "./../../../database/services/user.service";
import { getOwnerJids, isOwner } from "../../../shared/utils/owner";
import { sendMessageToGroup } from "../send-message";

/**
 * Listens for incoming WhatsApp messages.
 * Handles commands, gratitude messages, and auto-replies.
 */
export function MessageUpsertEvents(sock: WASocket) {
  // Services - Classes
  const groupService = new GroupService();
  const handleCommand = new HandleCommand();
  const userService = new UserService();

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

        if (isFromGroup) await countMessage(group, context, userService);
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
        if (action !== "promote" && action !== "demote") return;

        const isAdmin = action === "promote";
        await userService.setAdminStatus(
          groupJid,
          participants.map((jid) => ({ whatsappId: jid.id, isAdmin })),
        );
        logger.info(
          `Usuarios sincronizados en ${groupJid} (${participants.length}): ${action}`,
        );
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
    await sendMessageToGroup(ownerJid, text); // sendMessage funciona igual para DMs
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
