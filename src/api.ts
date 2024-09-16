import { treaty } from "@elysiajs/eden";
import type { App } from "~server/app";

const root = import.meta.env.VITE_ROOT_URL;
if (!root) {
  throw new Error("VITE_ROOT_URL environment variable is required");
}

const url = new URL(root);

export const api = treaty<App>(`${url.host}/api`);
