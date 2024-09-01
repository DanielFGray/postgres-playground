import { treaty } from "@elysiajs/eden";
import { type App } from "~server/app";

if (!import.meta.env.VITE_ROOT_URL) {
  throw new Error("ROOT_URL environment variable is required");
}
export const api = treaty<App>(import.meta.env.VITE_ROOT_URL.replace(/^https?:\/\//, '').concat("/api"));
