import { BanCommand } from "./ban/ban.command";
import { FindCommand } from "./find/find.command";
import { FindTopCommand } from "./findTop/findTop.command";
import { HelpCommand } from "./help/help.command";
import type { CommandHandler } from "./interfaces/command.interface";
import { PingCommand } from "./ping/ping.command";
import { ResetCommand } from "./reset/reset.command";
import { TopCommand } from "./top/top.command";

export const handlers: CommandHandler[] = [
  new PingCommand(),
  new TopCommand(),
  new FindCommand(),
  new BanCommand(),
  new FindTopCommand(),
  new ResetCommand(),
  new HelpCommand(),
];
