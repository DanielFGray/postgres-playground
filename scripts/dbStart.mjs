import postgres from "postgres";
import runAll from "npm-run-all";

export async function dbTest({
  minDelay = 50,
  maxTries = Infinity,
  maxDelay = 30000,
  verbose = true,
} = {}) {
  const sql = postgres(process.env.DATABASE_URL, {
    connect_timeout: 3,
  });

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await sql`select true as "test"`;
      if (result[0].test === true) break;
    } catch (e) {
      if (e.code === "28P01") {
        sql.end();
        throw e;
      }
      attempts++;
      if (attempts > maxTries) {
        sql.end();
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
      await Bun.sleep(delay);
    }
  }
  sql.end();
  return true;
}

const runAllOpts = {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  silent: true,
};

runAll(["db:start"], runAllOpts)
  .then(() =>
    dbTest({ maxTries: 5 }).catch(() => runAll(["setup"], runAllOpts)),
  )
  .catch(console.error);
