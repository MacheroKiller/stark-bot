export function getOwnerJids(): string[] {
  return (process.env.OWNER_WHATSAPP_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isOwner(jid: string): boolean {
  return getOwnerJids().includes(jid);
}
