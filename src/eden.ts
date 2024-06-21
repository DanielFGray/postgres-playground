import { edenFetch } from "@elysiajs/eden";
import type { App } from "~server/app";

export const api = edenFetch<App>("/api");
