import type { proto } from "baileys";

export interface CommandHandler {
  command: string;
  description: string;
  requiresAdmin?: boolean;
  execute(
    message: string,
    groupSender: string,
    userSender: string,
    msgObj?: proto.IWebMessageInfo,
  ): Promise<void>;
}
