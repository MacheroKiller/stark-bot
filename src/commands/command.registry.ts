import type { CommandHandler } from "./interfaces/command.interface";
import { PingCommand } from "./ping/ping.command";
import { TopCommand } from "./top/top.command";

export const handlers: CommandHandler[] = [new PingCommand(), new TopCommand()];
