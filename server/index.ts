import "./assertEnv";
import { app } from "./app";

app.listen(process.env.PORT);

console.log(`🦊 Elysia is running at ${app.server?.url}`);
