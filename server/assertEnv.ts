import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string(),
  ROOT_DATABASE_USER: z.string(),
  ROOT_DATABASE_PASSWORD: z.string(),
  ROOT_DATABASE_URL: z.string(),
  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_OWNER: z.string(),
  DATABASE_OWNER_PASSWORD: z.string(),
  DATABASE_URL: z.string(),
  DATABASE_AUTHENTICATOR: z.string(),
  DATABASE_AUTHENTICATOR_PASSWORD: z.string(),
  SHADOW_DATABASE_PASSWORD: z.string(),
  SHADOW_DATABASE_URL: z.string(),
  AUTH_DATABASE_URL: z.string(),
  DATABASE_VISITOR: z.string(),
  SECRET: z.string(),
  PORT: z.string(),
  VITE_ROOT_URL: z.string(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_PAT: z.string().optional(),
});
const schemaParsed = envSchema.safeParse(process.env);

if (!schemaParsed.success) {
  console.error(
    "did you forget to run the setup script?",
    schemaParsed.error.flatten(i => i.message).fieldErrors,
  );
  process.exit(1);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}

// export const env = schemaParsed.data;
