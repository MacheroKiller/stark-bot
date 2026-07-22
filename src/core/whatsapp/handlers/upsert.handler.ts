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

        const group = await groupService.findByWhatsappId(context.groupJid);
        if (!group) {
          logger.warn(`Grupo no registrado: ${context.groupJid}`);
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

        const groupBuild: Group = {
          whatsappId: groupInfo.id,
          name: groupInfo.subject,
        };

        await groupService.findOrCreate(groupBuild); // Registrar nuevo
        logger.info(
          `Grupo sincronizado: ${groupBuild.whatsappId} (${groupBuild.name})`,
        );
      } catch (error) {
        logger.error("Error procesando group.upsert", { error });
      }
    }
  });
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
