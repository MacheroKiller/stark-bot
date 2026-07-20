import type { proto } from "baileys";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";
import { sendMessageToGroup } from "../../core/whatsapp/send-message";

export class PingCommand implements CommandHandler {
  command = Commands.PING;
  description = "Verified bot";

  async execute(_: string, from: string): Promise<void> {
    const pingMessage = `Pong!`;
    await sendMessageToGroup(from, pingMessage.trim());
  }
}
