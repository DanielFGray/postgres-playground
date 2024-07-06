import { describe, it, expect, afterAll } from "bun:test";
import Postgres from "postgres";
import { treaty } from "@elysiajs/eden";
import { generateStr } from "~lib/index";
import { type App, lucia } from "~server/app";
import "./assertEnv";

const { DATABASE_URL, PORT } = process.env;

const app = treaty<App>(`http://localhost:${PORT}`);

const user = {
  username: `test_${generateStr(4)}`,
  email: `test_${generateStr(4)}@test.com`,
  password: generateStr(12),
};

describe("auth:user", () => {
  let userId: string;
  let Cookie: string;

  it("can register", async () => {
    const { headers, data, error } = await app.register.post(user);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(headers).toBeDefined();
    if (!data) return;

    userId = data.id as string;
    expect(data).toBeObject();
    expect(data.id).toBeString();
    expect(data.username).toBe(user.username);
    expect(data.role).toBeOneOf(["user", "admin"]);
    expect(headers?.get("set-cookie")).toContain(lucia.sessionCookieName);
    Cookie = headers?.get("set-cookie");
  });

  it("can not register with an existing username", async () => {
    const { error, data } = await app.register.post(user);
    expect(data).toBeNull();
    expect(error?.value).toEqual("username already exists");
  });

  it("can not login with wrong password", async () => {
    const { data, error } = await app.login.post({
      id: user.username,
      password: "wrong123",
    });
    expect(data).toBeNull();
    expect(error?.value).toEqual("invalid id or password");
  });

  it("can login with email", async () => {
    const { data, error } = await app.login.post({
      id: user.email,
      password: user.password,
    });
    expect(error?.value).not.toBeDefined();
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data.id).toEqual(userId);
    expect(data.username).toEqual(user.username);
    expect(data.role).toBeOneOf(["user", "admin"]);
  });

  it("can request /me from cookie", async () => {
    const { data, error } = await app.me.get();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data.id).toEqual(userId);
    expect(data.username).toEqual(user.username);
    expect(data.role).toBeOneOf(["user", "admin"]);
  });

  it("can use cookie to make new posts", async () => {
    const { data, error } = await app.playgrounds.post(
      {
        files: { "0001-test.sql": "select 1 as test" },
      },
      { headers: { Cookie } },
    );
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data).toBeObject();
    expect(data.id).toBeNumber();
  });

  it("can use cookie to list existing posts", async () => {
    const { data, error } = await app.playgrounds.get({ headers: { Cookie } });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data).toBeArray();
    expect(data).not.toBeEmpty();
  });
});

afterAll(async () => {
  const sql = Postgres(DATABASE_URL);
  await sql`delete from app_public.users where username = ${user.username}`;
  void sql.end();
});
