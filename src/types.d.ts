import type { Results as PgliteResults } from "@electric-sql/pglite";

declare module "*?url" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  interface WorkerConstructor {
    new (): Worker;
  }

  const Worker: WorkerConstructor;
  export default Worker;
}

declare module "*?raw" {
  const content: string;
  export default content;
}

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type Nullable<T> = { [K in keyof T]: T[K] | null };

declare type Results<T> = Prettify<
  { query: string; statement: string } & PgliteResults<T>
>;
