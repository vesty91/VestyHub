import { redactSensitiveData, redactSensitiveString } from "@/lib/security/redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogFields {
  [key: string]: unknown;
}

interface LoggerOptions {
  minLevel?: LogLevel;
  scope?: string;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      message: "Logger serialization failed safely.",
    });
  }
}

export class Logger {
  private readonly minLevel: LogLevel;
  private readonly scope?: string;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? "info";
    this.scope = options.scope;
  }

  child(scope: string): Logger {
    return new Logger({
      minLevel: this.minLevel,
      scope: this.scope ? `${this.scope}:${scope}` : scope,
    });
  }

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    try {
      if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) return;

      const entry = {
        timestamp: new Date().toISOString(),
        level,
        ...(this.scope ? { scope: this.scope } : {}),
        message: redactSensitiveString(message),
        ...(fields ? { fields: redactSensitiveData(fields) } : {}),
      };

      const line = safeStringify(entry);
      (level === "error" || level === "warn" ? console.error : console.log)(line);
    } catch {
      // Logging must never break application control flow.
    }
  }
}

const configuredLevel = process.env.LOG_LEVEL;
const minLevel: LogLevel =
  configuredLevel === "debug" || configuredLevel === "warn" || configuredLevel === "error"
    ? configuredLevel
    : "info";

export const logger = new Logger({ minLevel });
