import type { proto } from "baileys";

export const isGroupJid = (jid: string) => jid.includes("@g.us");
export const isUserJid = (jid: string) => jid.includes("@s.whatsapp.net");

export function extractChatJid(msg: proto.IWebMessageInfo): string {
  return msg?.key?.remoteJid ?? msg?.key?.participant ?? "unknown";
}

export function extractSenderJid(
  msg: proto.IWebMessageInfo,
): string | undefined {
  return msg?.key?.participant ?? msg?.key?.remoteJid ?? undefined;
}

/**
 * Elimina todos los JIDs que terminan en @lid.
 */
export function removeLidSuffix(jid: string): string {
  return jid.replace(/@lid$/, "");
}
