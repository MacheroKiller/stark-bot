import type { proto } from "baileys";
import { handlers } from "./command.registry";
import logger from "../shared/utils/logger";

export async function handleCommand(
  message: string,
  msgObj: proto.IWebMessageInfo,
  isFromGroup: boolean,
  isFromUser: boolean,
) {
  const [commandRaw] = message.trim().split(/\s+/);

  if (!commandRaw) return;

  const command = commandRaw.toLowerCase();
  const handler = handlers.find((h) => h.command === command);

  if (!handler) return;

  const groupJid = msgObj?.key?.remoteJid;
  const senderJid = msgObj?.key?.participant || msgObj?.key?.remoteJid;

  if (!senderJid) {
    logger.error("No se pudo obtener el número del remitente.");
    return;
  }

  if (!groupJid) {
    logger.error("No se pudo obtener el número del grupo.");
    return;
  }

  await handler.execute(message, groupJid, msgObj);
  return;

  //   const isFromAdmin = senderJid === ADMIN_NUMBER;
  //   const isAdminCommand = AdminCommands.includes(command);
  //   const isGroupCommand = GroupCommands.includes(command);
  //   const isLeaderGroupCommand = LeaderGroupCommands.includes(command);
  //   const isLeaderPrivateCommand = LeaderPrivateCommands.includes(command);

  //   // 1. Admin Commands (Only the admin can execute)
  //   if (isFromAdmin && isAdminCommand) {
  //     await handler.execute(message, senderJid, msgObj);
  //     return;
  //   }

  //   const isLeader = await groupUserService.isLeader(senderJid);

  //   // 2. Group Commands and Leader Commands
  //   if (isFromGroup) {
  //     // puede ser el start de un grupo nuevo
  //     if (command === Commands.START) {
  //       await handler.execute(message, groupJid, msgObj);
  //       return;
  //     }

  //     const groupDb = await groupService.findAuthorizedByWhatsappId(groupJid);

  //     if (!groupDb) {
  //       logger.warn(`⚠️ El grupo ${groupJid} no está registrado.`);
  //       return;
  //     }

  //     // puede ser el comando de registro de un usuario a un grupo
  //     if (command === Commands.REGISTER) {
  //       await handler.execute(message, groupJid, msgObj);
  //       return;
  //     }

  //     const isMember = groupDb.members?.find(
  //       (members) => members.user?.whatsappId === senderJid,
  //     );

  //     if (!isMember) {
  //       logger.warn(
  //         `⚠️ El usuario ${senderJid} no está registrado en el grupo ${groupJid}.`,
  //       );
  //       return;
  //     }

  //     if (isGroupCommand || (isLeaderGroupCommand && isLeader)) {
  //       return handler.execute(message, groupJid, msgObj);
  //     }

  //     return;
  //   }

  //   // Fuera de un grupo

  //   if (!isFromGroup && isFromUser && isLeader && isLeaderPrivateCommand) {
  //     await handler.execute(message, senderJid, msgObj);
  //     return;
  //   }
}
