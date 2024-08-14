import "./assertEnv";
import path from "path";
import { run, makeWorkerUtils, WorkerUtils, Runner } from "graphile-worker";

let worker: WorkerUtils, runner: Runner;

export async function createWorker() {
  // TODO: use postgres.js instead of node-pg, eg with postgres-bridge
  const pgPool = new (await import("pg")).default.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  worker = await makeWorkerUtils({ pgPool });
  // await worker.migrate();

  // runner = await run({ pgPool, taskDirectory: path.resolve("./worker/tasks") });

  // await runner.promise;
}

export const getWorker = () => worker;

// does this need to be exported?
// export const getRunner = () => runner;
