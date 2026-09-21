import type { proto } from "baileys";

export interface CommandHandler {
  command: string;
  description: string;
  requiresAdmin?: boolean;
  requiresOwner?: boolean;
  locked?: boolean; // default false. Si true => No se puede sobreescribir.
  execute(
    message: string,
    groupSender: string,
    userSender: string,
    msgObj?: proto.IWebMessageInfo,
  ): Promise<void>;
}
