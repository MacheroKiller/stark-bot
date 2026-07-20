import type { CommandHandler } from "./interfaces/command.interface";
import { PingCommand } from "./ping/ping.command";

export const handlers: CommandHandler[] = [new PingCommand()];
