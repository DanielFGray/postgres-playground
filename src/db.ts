import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
import { Result } from "./types";

let db: null | PGlite = new PGlite();
db.query('select 1')

export async function query(query: string): Promise<Result> {
  if (!db) db = new PGlite();
  const result = await db.exec(query);
  return result;
}

export async function freshQueryWithMigrations(
  migrations: string[],
  inputQuery: string,
  params?: string[],
): Promise<Result> {
  return freshQueryContext(async db => {
    for (const m of migrations) {
      await db.execute(m);
    }
    return await query(inputQuery, params);
  });
}

export async function freshQueryContext<T>(
  cb: (db: PGlite) => Promise<T>,
): Promise<T> {
  if (db) await db.close();
  db = new PGlite();
  return await cb(db);
}
