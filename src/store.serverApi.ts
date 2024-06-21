import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { App as ServerApp } from "~server/app";
import { edenTreaty } from "@elysiajs/eden";

const server = edenTreaty<ServerApp>("/api");

export const serverApi = createApi({
  baseQuery: fakeBaseQuery(),
  endpoints: build => ({
    me: build.query({
      async queryFn() {
        const { error, ...rest } = await server.me.get();
        const { data: body, ...head } = rest;
        return { data: {body, ...head}, error };
      },
    }),
    post: build.query({ queryFn: () => server.me.get() }),
  }),
});
