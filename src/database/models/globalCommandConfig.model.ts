import { Collections } from "../collections";
import type { GlobalCommandConfig } from "../interfaces/globalCommandConfig.interface";
import { getDb } from "../mongo";

export function getGlobalCommandConfigCollection() {
  return getDb().collection<GlobalCommandConfig>(
    Collections.GLOBAL_COMMAND_CONFIG,
  );
}
