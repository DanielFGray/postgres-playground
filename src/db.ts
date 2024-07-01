import { types, Results, PGlite } from "@electric-sql/pglite";
import {
  makeIntrospectionQuery,
  parseIntrospectionResults,
} from "pg-introspection";
import { DbIntrospection } from "~/lib/introspection";
import * as semicolons from 'postgres-semicolons';
import { zip } from "~/lib";

let db: PGlite = new PGlite();
db.query("select 1").then(() => console.log("database loaded"));

const parsers = {
  [types.TIMESTAMP]: value => value.toString(),
  [types.TIMESTAMPTZ]: value => value.toString(),
};

export async function query(
  query: string,
  params?: any[],
): Promise<Array<[string, Results]>> {
  if (!db) db = new PGlite();
  const result = await db.exec(query, params, { parsers });
  const splits = semicolons.parseSplits(query, true);
  const queries = semicolons.splitStatements(query, splits.positions, true);
  return zip(queries, result);
}

export async function resetDb(): Promise<void> {
  if (db) await db.close();
  db = null
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
