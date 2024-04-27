import {
  useDispatch as useUntypedDispatch,
  useSelector as useUntypedSelector,
} from "react-redux";
import {
  configureStore,
  buildCreateSlice,
  asyncThunkCreator,
  SerializedError,
  combineSlices,
  createSelector,
} from "@reduxjs/toolkit";
import * as db from "./db";
import { Result } from "./types";
import { DbSchema } from "./lib/introspection";

const createSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});

const uiSlice = createSlice({
  name: "ui",

  initialState: {
    filebarVisible: true,
    previewVisible: true,
    introspectionVisible: true,
  },

  reducers: create => ({
    filebarToggled: create.reducer(state => {
      state.filebarVisible = !state.filebarVisible;
    }),

    introspectionToggled: create.reducer(state => {
      state.introspectionVisible = !state.introspectionVisible;
    }),

    previewToggled: create.reducer(state => {
      state.previewVisible = !state.previewVisible;
    }),
  }),

  extraReducers: builder => {
    builder.addCase(querySlice.actions.executeQuery.fulfilled, state => {
      state.previewVisible = true;
    });
  },
});

export const { previewToggled, filebarToggled, introspectionToggled } =
  uiSlice.actions;

const defaultFiles = {
  "0001-default.sql": `
-- welcome to pgfiddle, a browser-based playground for postgresql
drop table if exists nums cascade;

create table nums as
  select gen_random_uuid(), * from generate_series(1000, 10000);

alter table nums add primary key(gen_random_uuid);
create index on nums ((generate_series % 2000));
analyze;

select * from nums where (generate_series % 2000) = 0;

explain (analyze, buffers)
select * from nums where (generate_series % 2000) = 0;
`.trim(),
};

const querySlice = createSlice({
  name: "queries",
  initialState: {
    currentPath: "0001-default.sql",
    files: defaultFiles as Record<string, string>,
    result: null as null | Result | Result[],
    plan: null as null | string,
    error: null as null | SerializedError,
    introspection: null as null | Record<string, DbSchema>,
    pending: false,
  },

  selectors: {
    getFileList: createSelector([state => state.files], files =>
      Object.keys(files).sort((a, b) => a.localeCompare(b))
    ),

    getCurrentFile: createSelector(
      [state => state.currentPath, state => state.files],
      (path, files) => ({ path, value: files[path] }),
    ),
  },

  reducers: create => ({
    newFile: create.reducer<string>((state, action) => {
      state.files[action.payload] = "";
    }),

    currentFileChanged: create.reducer<string>((state, action) => {
      state.currentPath = action.payload;
    }),

    queryChanged: create.reducer<string>((state, action) => {
      state.files[state.currentPath] = action.payload;
    }),

    introspectionRequested: create.asyncThunk(
      async () => {
        console.log("introspectionRequested");
        return db.introspectDb();
      },
      {
        rejected: (state, action) => {
          console.error("introspectionRejected", action.payload);
          state.introspection = action.payload;
        },
        fulfilled: (state, action) => {
          console.log("introspectionFulfilled", action.payload);
          state.introspection = action.payload;
        },
      },
    ),

    executeQuery: create.asyncThunk(
      async (query: string | undefined, { getState, dispatch }) => {
        const state = getState() as RootState;
        if (!query?.trim()) {
          query = state.queries.files[state.queries.currentPath];
        }
        console.log("executing query", query);
        const result = await db.query(query);
        dispatch(querySlice.actions.introspectionRequested(null));
        return result;
      },
      {
        pending: state => {
          state.pending = true;
        },
        fulfilled: (state, action) => {
          state.error = null;
          state.result = action.payload;
        },
        rejected: (state, action) => {
          state.error = action.error;
        },
        settled: state => {
          state.pending = false;
        },
      },
    ),
  }),
});

export const { executeQuery, queryChanged, newFile, currentFileChanged } =
  querySlice.actions;
export const { getCurrentFile, getFileList } = querySlice.selectors;

const rootReducer = combineSlices(uiSlice, querySlice);
export const store = configureStore({ reducer: rootReducer });

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useDispatch = useUntypedDispatch.withTypes<AppDispatch>();
export const useSelector = useUntypedSelector.withTypes<RootState>();
