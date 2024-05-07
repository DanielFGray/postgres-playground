import {
  types,
  PGlite,
} from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
import { Result } from "./types";
import {
  makeIntrospectionQuery,
  parseIntrospectionResults,
} from "pg-introspection";
import { DbIntrospection, processIntrospection } from "./lib/introspection";

let db: PGlite = new PGlite();
db.query("select 1").then(() => console.log("database loaded"));

const parsers = {
  [types.TIMESTAMP]: value => value.toString(),
  [types.TIMESTAMPTZ]: value => value.toString(),
};

export async function query(query: string, params?: any[]): Promise<Result> {
  if (!db) db = new PGlite();
  const result = await db.exec(query, params, { parsers });
  return result;
}

export async function freshQueryWithMigrations(
  migrations: string[],
  inputQuery: string,
  params?: string[],
): Promise<Result> {
  return freshQueryContext(async db => {
    for (const m of migrations) {
      await db.execute(m, { parsers });
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

export async function introspectDb() {
  try {
    const {
      rows: [{ introspection }],
    }: Result = await db.query(makeIntrospectionQuery());
    return new DbIntrospection(parseIntrospectionResults(introspection)).schemas;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
