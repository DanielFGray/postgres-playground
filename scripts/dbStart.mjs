// @ts-check
import pg from "pg";
import runAll from "npm-run-all";
import "dotenv/config";

/** @param {string} url */
export async function dbTest(
  url,
  { minDelay = 50, maxTries = Infinity, maxDelay = 30000, verbose = true } = {},
) {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  });

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const { rows: result } = await pool.query('select true as "test"');
      if (result[0].test === true) break;
    } catch (e) {
      if (e.code === "28P01") {
        await pool.end();
        throw e;
      }
      attempts++;
      if (attempts > maxTries) {
        await pool.end();
        throw e;
      }
      if (verbose)
        console.log(
          `Database is not ready yet (attempt ${attempts}): ${e.message}`,
        );
      const delay = Math.min(
        Math.floor((minDelay * 1.8 ** attempts) / 2),
        maxDelay,
      );
      await new Promise(res => setTimeout(() => res(), delay));
    }
  }
  pool.end();
  return true;
}

const runAllOpts = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  silent: true,
};

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  await runAll(["db:start"], runAllOpts);
  await dbTest(process.env.DATABASE_URL, {
    maxTries: 8,
    verbose: false,
  });
} catch (e) {
  console.error(e.message);
  runAll(["setup"], runAllOpts).catch(console.error);
}
