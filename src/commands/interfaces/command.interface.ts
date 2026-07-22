import type { proto } from "baileys";

export interface CommandHandler {
  command: string;
  description: string;
  execute(
    message: string,
    sender: string,
    msgObj?: proto.IWebMessageInfo,
  ): Promise<void>;
}
