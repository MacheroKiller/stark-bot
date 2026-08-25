import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class JobCommand implements CommandHandler {
  command = Commands.JOB;
  description = "Give a list of jobs";
  requiresAdmin = false;

  async execute(_: string, groupSender: string): Promise<void> {
    await sendMessageToGroup(
      groupSender,
      `*Here are the available commands:*\n\n` +
        `*Public commands:*\n` +
        `*/help* - _Displays help information for the bot_\n` +
        `*/ping* - _Checks if the bot is alive_\n` +
        `*/find* - _Searches for a user in the group_\n` +
        `*/findtop* - _Finds the top message sender in the group_\n` +
        `*/job* - _Shows places to look for job opportunities_\n\n` +
        `*Admin-only commands:*\n` +
        `*/top* - _Shows the top message senders in the group_\n` +
        `*/ban* - _Bans a user from the group_\n` +
        `*/purge* - _Removes inactive users from the group_\n` +
        `*/reset* - _Resets all users' message counters_\n\n` +
        `*_Ads:_*\n` +
        `*_Give me a star ⭐_*\n` +
        `https://github.com/MacheroKiller/stark-bot`,
    );
  }
}
