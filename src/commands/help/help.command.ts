import { sendMessageToGroup } from "../../core/whatsapp/send-message";
import { GlobalCommandConfigService } from "../../database/services/globalCommandConfig.service";
import { GroupService } from "../../database/services/group.service";
import { UserService } from "../../database/services/user.service";
import { isOwner } from "../../shared/utils/owner/owner";
import { handlers } from "../command.registry";
import { Commands } from "../enums/commands.enum";
import type { CommandHandler } from "../interfaces/command.interface";

export class HelpCommand implements CommandHandler {
  command = Commands.HELP;
  description = "Displays help information for the bot.";
  requiresAdmin = false;

  private readonly groupService = new GroupService();
  private readonly globalCommandConfigService =
    new GlobalCommandConfigService();
  private readonly userService = new UserService();

  // ---
  // Command execution
  // ---

  async execute(
    _: string,
    groupSender: string,
    userSender: string,
  ): Promise<void> {
    const requesterIsOwner = isOwner(userSender);

    // ---
    // Request context
    // ---

    const group = await this.groupService.findByWhatsappId(groupSender);
    const isDirectMessage = group === null;

    const requesterUser = group
      ? await this.userService.findUser(groupSender, userSender)
      : null;
    const requesterIsAdmin = requesterUser?.isAdmin ?? false;

    // ---
    // Global command configuration
    // ---

    const globalConfigs = await this.globalCommandConfigService.findAll();
    const globalConfigMap = new Map(globalConfigs.map((c) => [c.command, c]));

    const publicLines: string[] = [];
    const adminLines: string[] = [];
    const ownerLines: string[] = [];

    // ---
    // Command visibility and permissions
    // ---

    for (const handler of handlers) {
      if (handler.requiresOwner) {
        if (requesterIsOwner) {
          ownerLines.push(this.formatLine(handler, "always available"));
        }
        continue;
      }

      const globalConfig = globalConfigMap.get(handler.command);
      const globallyDisabled = globalConfig && !globalConfig.enabled;

      if (globallyDisabled && !requesterIsOwner) continue; // Hidden from non-owners

      const override = group?.commandOverrides?.[handler.command];
      const groupDisabled = override && !override.enabled;

      if (groupDisabled && !requesterIsOwner) continue;

      const effectiveRequiresAdmin = handler.locked
        ? (handler.requiresAdmin ?? false)
        : (override?.requiresAdmin ?? handler.requiresAdmin ?? false);

      const statusFlag = globallyDisabled
        ? " ⛔ disabled globally"
        : groupDisabled
          ? " ⛔ disabled in this group"
          : "";

      const line = this.formatLine(handler, undefined, statusFlag);

      if (effectiveRequiresAdmin) {
        adminLines.push(line);
      } else {
        publicLines.push(line);
      }
    }

    // ---
    // Help message sections
    // ---

    let text = `*Here are the available commands:*\n\n`;
    text += `*Public commands:*\n${publicLines.join("\n")}\n\n`;

    if (requesterIsAdmin || requesterIsOwner) {
      text += `*Admin-only commands:*\n${adminLines.join("\n")}\n\n`;
    }

    if (requesterIsOwner && isDirectMessage && ownerLines.length > 0) {
      text += `*Owner-only commands:*\n${ownerLines.join("\n")}\n\n`;
    }

    // ---
    // Footer
    // ---

    text += `*_Ads:_*\n*_Give me a star ⭐_*\nhttps://github.com/MacheroKiller/stark-bot`;

    await sendMessageToGroup(groupSender, text);
  }

  // ---
  // Command line formatting
  // ---

  private formatLine(
    handler: CommandHandler,
    ownerNote?: string,
    statusFlag = "",
  ): string {
    const note = ownerNote ? ` _(${ownerNote})_` : "";
    return `*${handler.command}* - _${handler.description}_${note}${statusFlag}`;
  }
}
