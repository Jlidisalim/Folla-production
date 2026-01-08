import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

const isDev = process.env.NODE_ENV !== "production";

// Redaction paths - these will never be logged
const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "password",
  "token",
  "secret",
  "apiKey",
  "creditCard",
  "ssn",
];

// Base logger configuration
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

// HTTP request logger middleware
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    // Use existing request ID or generate new one
    return (req.headers["x-request-id"] as string) || randomUUID();
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  redact: redactPaths,
  // Don't log health check requests to avoid noise
  autoLogging: {
    ignore: (req) => {
      return req.url === "/health" || req.url === "/";
    },
  },
  customProps: (req) => ({
    requestId: req.id,
  }),
});

export default logger;
