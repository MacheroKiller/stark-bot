export interface ILogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string | Error, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const colors: Record<LogLevel, string> = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

export interface LogMeta {
  [key: string]: any;
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void;
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string | Error, meta?: LogMeta): void;
  child(namespace: string): Logger;
}

const DEFAULT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "debug";
const JSON_LOG =
  process.env.JSON_LOG === "true" || process.env.NODE_ENV === "production";

function nowIso(): string {
  return new Date().toISOString();
}

function serializeMeta(meta?: LogMeta) {
  if (!meta) return undefined;
  try {
    return JSON.parse(JSON.stringify(meta, replacer));
  } catch {
    return String(meta);
  }

  function replacer(_k: string, v: any) {
    if (v instanceof Error) {
      return { message: v.message, stack: v.stack, name: v.name };
    }
    return v;
  }
}

function shouldLog(level: LogLevel) {
  return (
    levelPriority[level] >=
    levelPriority[(process.env.LOG_LEVEL as LogLevel) || DEFAULT_LEVEL]
  );
}

export function createLogger(namespace?: string): Logger {
  function log(level: LogLevel, message: string | Error, meta?: LogMeta) {
    if (!shouldLog(level)) return;

    const timestamp = nowIso();
    let msg = typeof message === "string" ? message : message.message;
    const metaObj = serializeMeta({
      ...(meta || {}),
      ...(message instanceof Error
        ? {
            error: {
              name: message.name,
              message: message.message,
              stack: message.stack,
            },
          }
        : {}),
    });

    if (JSON_LOG) {
      const payload: any = {
        ts: timestamp,
        level,
        namespace,
        msg,
      };
      if (metaObj) payload.meta = metaObj;
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(payload));
      return;
    }

    const color = colors[level] || "";
    const ns = namespace ? `[${namespace}] ` : "";
    const metaStr = metaObj ? ` ${JSON.stringify(metaObj)}` : "";
    // eslint-disable-next-line no-console
    console.log(
      `${color}${timestamp} ${level.toUpperCase()} ${ns}${msg}${metaStr}${RESET}`,
    );
  }

  return {
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    child: (ns: string) =>
      createLogger([namespace, ns].filter(Boolean).join(":")),
  };
}

const logger = createLogger();
export default logger;
