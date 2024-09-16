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
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(headers).toBeDefined();
    userId = data?.id as string;
    expect(data).toBeObject();
    expect(data?.id).toBeString();
    expect(data?.username).toBe(user.username);
    expect(data?.role).toBeOneOf(["user", "admin"]);
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
    expect(error?.value).toContain("invalid id or password");
  });

  it("can login with email", async () => {
    const { data, error } = await app.login.post({
      id: user.email,
      password: user.password,
    });
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data?.id).toEqual(userId);
    expect(data?.username).toEqual(user.username);
    expect(data?.role).toBeOneOf(["user", "admin"]);
  });

  it("can request /me from cookie", async () => {
    const { data, error } = await app.me.get({ headers: { Cookie } });
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data?.id).toEqual(userId);
    expect(data?.username).toEqual(user.username);
    expect(data?.role).toBeOneOf(["user", "admin"]);
  });

  let postId: number;
  it("can use cookie to make new posts", async () => {
    const { data, error } = await app.playgrounds.post(
      { files: { "0001-test.sql": "select 1 as test" } },
      { headers: { Cookie } },
    );
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data).toBeNumber();
    postId = data as number;
  });

  it("can fetch new post without cookie", async () => {
    const { data, error } = await app.playground({ id: postId }).get();
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data).toBeObject();
    expect(data?.id).toBe(postId);
  });

  it("can list user's own posts", async () => {
    const { data, error } = await app.u({ username: user.username }).get();
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data).toBeArray();
    expect(data).not.toBeEmpty();
  });

  it("can use cookie to list latest posts", async () => {
    const { data, error } = await app.playgrounds.get({ headers: { Cookie } });
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data).toBeArray();
    expect(data).not.toBeEmpty();
  });

  let secretPostId: number;
  it("can use cookie to make private post", async () => {
    const { data, error } = await app.playgrounds.post(
      {
        files: { "0001-test.sql": "select 1 as test" },
        privacy: "private",
      },
      { headers: { Cookie } },
    );
    expect(error?.value).toBeUndefined();
    expect(data).not.toBeNull();
    expect(data).toBeNumber();
    secretPostId = data as number;
  });

  it("can not fetch secret post without cookie", async () => {
    const { data, error } = await app.playground({ id: secretPostId }).get();
    expect(error?.status).toBe(404);
    expect(data).toBeFalsy();
  });

  it("can fetch secret post with cookie", async () => {
    const { data, error } = await app
      .playground({ id: secretPostId })
      .get({ headers: { Cookie } });
    expect(error?.value).toBeUndefined();
    expect(data).toBeObject();
    expect(data?.id).toBe(secretPostId);
  });
});

afterAll(async () => {
  const sql = Postgres(DATABASE_URL);
  await sql`delete from app_public.users where username = ${user.username}`;
  void sql.end();
});
