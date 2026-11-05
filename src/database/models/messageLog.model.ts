import { Collections } from "../collections";
import type { MessageLog } from "../interfaces/messageLog.interface";
import { getDb } from "../mongo";

export function getMessageLogCollection() {
  return getDb().collection<MessageLog>(Collections.MESSAGE_LOGS);
}
