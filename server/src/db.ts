// Where the database lives and how to open it. Used by the app, the seed script and prisma.config.ts.
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** DATABASE_URL from server/.env (default file:./prisma/raahi.db). A relative SQLite path is resolved from server/. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL || 'file:./prisma/raahi.db';
  if (!url.startsWith('file:')) return url;
  const path = url.slice('file:'.length);
  return `file:${isAbsolute(path) ? path : resolve(SERVER_DIR, path)}`;
}

/**
 * Prisma 7 client over SQLite via the better-sqlite3 driver adapter (no native Prisma engine at runtime).
 * The client is generated into src/generated/prisma by `prisma generate` (part of npm run setup).
 */
export async function createPrisma() {
  const [{ PrismaClient }, { PrismaBetterSqlite3 }] = await Promise.all([
    import('./generated/prisma/client'),
    import('@prisma/adapter-better-sqlite3'),
  ]);
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
}
