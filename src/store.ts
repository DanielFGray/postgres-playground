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
import { numsQuery as defaultFiles } from "./queryTemplates";

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

const executeQueryThunk = async (query: string | undefined, { getState, dispatch }) => {
  const state = getState() as RootState
  if (!query?.trim()) {
    query = state.queries.files[state.queries.currentPath];
  }
  const result = await db.query(query);
  dispatch(querySlice.actions.introspectionRequested(null));
  return result;
}

const querySlice = createSlice({
  name: "queries",
  initialState: {
    currentPath: Object.keys(defaultFiles).sort((a, b) => a.localeCompare(b)).at(-1),
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

    introspectionRequested: create.asyncThunk(db.introspectDb, {
      rejected: (state, action) => {
        state.introspection = action.payload;
      },
      fulfilled: (state, action) => {
        // TODO: add a toggle for showing/hiding system schemas?
        const { pg_catalog, pg_toast, ...useful } = action.payload;
        state.introspection = useful;
      },
    }),

    executeQuery: create.asyncThunk(executeQueryThunk, {
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
    }),
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
