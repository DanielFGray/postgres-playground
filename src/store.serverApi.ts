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
        if (error || ! rest.data) return { error };
        const { data, headers, status, ok } = rest
        return { data, headers, status, ok };
      },
    }),
    post: build.query({ queryFn: () => server.me.get() }),
  }),
});
