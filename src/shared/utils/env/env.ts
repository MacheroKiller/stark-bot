export function isDevelopment(): boolean {
  return process.env.BOT_ENV === "development";
}

export function getDevAllowedGroupJids(): string[] {
  return (process.env.DEV_ALLOWED_GROUP_JIDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isGroupAllowedInCurrentEnv(groupJid: string): boolean {
  if (!isDevelopment()) return true;

  return getDevAllowedGroupJids().includes(groupJid);
}
