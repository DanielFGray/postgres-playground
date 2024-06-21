import "./assertEnv";
import { app } from "./app";
import { createWorker } from "./worker";

app.listen(process.env.PORT);

createWorker().catch(err => {
  console.error(err);
  process.exit(1);
});

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port} `,
);
