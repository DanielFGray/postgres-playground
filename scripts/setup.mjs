// @ts-check
import Bun from "bun";
import postgres from "postgres";
import inquirer from "inquirer";
import "../server/assertEnv";

const {
  DATABASE_OWNER,
  DATABASE_OWNER_PASSWORD,
  DATABASE_NAME,
  ROOT_DATABASE_URL,
  DATABASE_VISITOR,
  DATABASE_AUTHENTICATOR,
  DATABASE_AUTHENTICATOR_PASSWORD,
} = process.env;

const RECONNECT_BASE_DELAY = 100;
const RECONNECT_MAX_DELAY = 30000;

(async function main() {
  const sql = postgres(ROOT_DATABASE_URL, {
    onnotice: n => console.log(n.message),
  });

  let attempts = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await sql`select true as "test"`;
      if (result[0].test === true) break;
    } catch (e) {
      if (e.code === "28P01") throw e;
      attempts++;
      if (attempts > 30) {
        console.log(`Database never came up, aborting :(`);
        process.exit(1);
      }
      if (attempts > 1) {
        console.log(
          `Database is not ready yet (attempt ${attempts}): ${e.message}`,
        );
      }
      const delay = Math.floor(
        Math.min(
          RECONNECT_MAX_DELAY,
          RECONNECT_BASE_DELAY * Math.random() * 2 ** attempts,
        ),
      );
      await Bun.sleep(delay);
    }
  }

  console.log(`DROP DATABASE ${DATABASE_NAME}`);
  console.log(`DROP ROLE ${DATABASE_OWNER}`);

  const { confirm } = process.env.NOCONFIRM
    ? { confirm: true }
    : await inquirer.prompt([
        {
          name: "confirm",
          message: "press y to continue:",
          type: "confirm",
          prefix: "",
        },
      ]);
  if (!confirm) process.exit();

  try {
    await sql`drop database if exists ${sql.unsafe(DATABASE_NAME)}`;
    await sql`drop database if exists ${sql.unsafe(DATABASE_NAME)}_shadow`;
    await sql`drop database if exists ${sql.unsafe(DATABASE_NAME)}_test`;
    await sql`drop role if exists ${sql.unsafe(DATABASE_AUTHENTICATOR)}`;
    await sql`drop role if exists ${sql.unsafe(DATABASE_VISITOR)}`;
    await sql`drop role if exists ${sql.unsafe(DATABASE_OWNER)}`;
    await sql`create database ${sql.unsafe(DATABASE_NAME)}`;
    console.log(`CREATE DATABASE ${DATABASE_NAME}`);
    await sql`create database ${sql.unsafe(DATABASE_NAME)}_shadow`;
    console.log(`CREATE DATABASE ${DATABASE_NAME}_shadow`);
    await sql`create database ${sql.unsafe(DATABASE_NAME)}_test`;
    console.log(`CREATE DATABASE ${DATABASE_NAME}_test`);

    /* Now to set up the database cleanly:
     * Ref: https://devcenter.heroku.com/articles/heroku-postgresql#connection-permissions
     *
     * This is the root role for the database
     * IMPORTANT: don't grant SUPERUSER in production, we only need this so we can load the watch fixtures!
     */
    if (process.env.NODE_ENV === "production") {
      await sql`create role ${sql.unsafe(DATABASE_OWNER)} with login password '${sql.unsafe(
        DATABASE_OWNER_PASSWORD,
      )}' noinherit`;
      console.log(`CREATE ROLE ${DATABASE_OWNER}`);
    } else {
      await sql`create role ${sql.unsafe(DATABASE_OWNER)} with login password '${sql.unsafe(
        DATABASE_OWNER_PASSWORD,
      )}' superuser`;
      console.log(`CREATE ROLE ${DATABASE_OWNER} SUPERUSER`);
    }

    await sql`grant all privileges on database ${sql.unsafe(DATABASE_NAME)} to ${sql.unsafe(
      DATABASE_OWNER,
    )}`;
    console.log(`GRANT ${DATABASE_OWNER}`);

    await sql`create role ${sql.unsafe(DATABASE_AUTHENTICATOR)} with login password '${sql.unsafe(
      DATABASE_AUTHENTICATOR_PASSWORD,
    )}' noinherit`;
    console.log(`CREATE ROLE ${DATABASE_AUTHENTICATOR}`);

    await sql`create role ${sql.unsafe(DATABASE_VISITOR)}`;
    console.log(`CREATE ROLE ${DATABASE_VISITOR}`);

    // This enables PostGraphile to switch from DATABASE_AUTHENTICATOR to DATABASE_VISITOR
    await sql`grant ${sql.unsafe(DATABASE_VISITOR)} to ${sql.unsafe(DATABASE_AUTHENTICATOR)}`;
    console.log(`GRANT ${DATABASE_VISITOR} TO ${DATABASE_AUTHENTICATOR}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
})();
