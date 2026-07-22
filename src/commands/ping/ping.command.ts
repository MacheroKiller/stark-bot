import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class PingCommand implements CommandHandler {
  command = Commands.PING;
  description = "Verified bot";

  async execute(_: string, sender: string): Promise<void> {
    const pingMessage = `Pong!`;
    await sendMessageToGroup(sender, pingMessage.trim());
  }
}
