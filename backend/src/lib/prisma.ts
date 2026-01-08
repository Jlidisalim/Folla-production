// server/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * Use a single global PrismaClient instance in dev to avoid
 * creating multiple clients during hot reloads (ts-node-dev / nodemon).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore
  var __prisma__: PrismaClient | undefined;
}

const prisma =
  // If running in Node dev with hot reload, reuse the client to avoid connection explosion.
  global.__prisma__ ??
  new PrismaClient({
    // optional logging:
    // log: ['query', 'info', 'warn', 'error']
  });

// @ts-ignore
if (process.env.NODE_ENV !== "production") global.__prisma__ = prisma;

export default prisma;
