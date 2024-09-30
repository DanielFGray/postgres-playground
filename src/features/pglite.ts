import * as semicolons from "postgres-semicolons";
import { PGlite, type QueryOptions } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { vector } from "@electric-sql/pglite/vector";
import { amcheck } from "@electric-sql/pglite/contrib/amcheck";
import { auto_explain } from "@electric-sql/pglite/contrib/auto_explain";
import { bloom } from "@electric-sql/pglite/contrib/bloom";
import { btree_gin } from "@electric-sql/pglite/contrib/btree_gin";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";
import { fuzzystrmatch } from "@electric-sql/pglite/contrib/fuzzystrmatch";
import { hstore } from "@electric-sql/pglite/contrib/hstore";
import { isn } from "@electric-sql/pglite/contrib/isn";
import { lo } from "@electric-sql/pglite/contrib/lo";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { seg } from "@electric-sql/pglite/contrib/seg";
import { tablefunc } from "@electric-sql/pglite/contrib/tablefunc";
import { tcn } from "@electric-sql/pglite/contrib/tcn";
import { tsm_system_rows } from "@electric-sql/pglite/contrib/tsm_system_rows";
import { tsm_system_time } from "@electric-sql/pglite/contrib/tsm_system_time";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

// TODO: avoid module scoping this
// TODO: maybe use https://pglite.dev/docs/multi-tab-worker
let db: PGlite;
try {
  reset().then(healthcheck);
} catch (e) {
  console.error(e);
}

export async function reset() {
  if (db) await db.close();
  db = await PGlite.create({
    // fs, // fails at runtime for missing emscriptenOpts
    extensions: {
      live,
      vector,
      amcheck,
      auto_explain,
      bloom,
      btree_gin,
      btree_gist,
      citext,
      cube,
      earthdistance,
      fuzzystrmatch,
      hstore,
      isn,
      lo,
      ltree,
      pg_trgm,
      seg,
      tablefunc,
      tcn,
      tsm_system_rows,
      tsm_system_time,
      uuid_ossp,
    },
  });
  window.db = db
}

async function healthcheck() {
  return (await db.query<{test: 1}>("select 1 as test")).rows[0]?.test === 1;
}

export function query<T>(
  query: string,
  params?: any[] | undefined,
  opts?: QueryOptions,
) {
  const result = db.query<T>(query, params, opts);
  return Object.assign(result, { statement: statementFromQuery(query) });
}

export async function exec(sql: string, opts?: QueryOptions) {
  const results = db.exec(sql, opts);
  const metadata = metadataFromQueries(sql)
  return (await results).map((r, i) => Object.assign(r, metadata[i]));
}

function metadataFromQueries(sql: string) {
  const splits = semicolons.parseSplits(sql, false);
  const queries = semicolons.splitStatements(sql, splits.positions, true);
  return queries.map(q => {
    const statement = statementFromQuery(q);
    return { query: q, statement };
  });
}

function statementFromQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  const firstWords = lowerQuery.slice(0, 30).split(/\s+/);
  const statement = lowerQuery.toLowerCase().startsWith("create or replace")
    ? [firstWords[0], firstWords[3]].join(" ").toUpperCase()
    : lowerQuery.startsWith("create") ||
        lowerQuery.startsWith("alter") ||
        lowerQuery.startsWith("drop")
      ? firstWords.slice(0, 2).join(" ").toUpperCase()
      : firstWords[0].toUpperCase();
  return statement;
}
