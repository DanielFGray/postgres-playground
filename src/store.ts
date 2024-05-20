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
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import * as db from "~/db";
import { Result } from "~/types";
import { DbSchema } from "~/lib/introspection";
import { defaultFiles } from "~/queryTemplate";

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

const querySlice = createSlice({
  name: "queries",
  initialState: {
    result: null as null | Result | Result[],
    plan: null as null | string,
    error: null as null | SerializedError,
    introspection: null as null | Record<string, DbSchema>,
    pending: false,
  },

  reducers: create => ({
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

    executeQuery: create.asyncThunk(
      async (query: string | undefined, { getState }) => {
        const state = getState() as RootState;
        if (!query?.trim()) {
          query = state.files.files[state.files.currentPath];
        }
        const result = await db.query(query);
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

    executeAllQueries: create.asyncThunk(
      async (_, { getState, dispatch }) => {
        const state = getState() as RootState;
        const files = Object.keys(state.files.files).sort((a, b) =>
          a.localeCompare(b),
        );
        let result = [] as Array<Result>;
        for (const f of files) {
          const query = state.files.files[f];
          result = result.concat(await db.query(query));
        }
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

export const { executeAllQueries, executeQuery } = querySlice.actions;

const filesSlice = createSlice({
  name: "files",
  initialState: {
    currentPath: Object.keys(defaultFiles)
      .sort((a, b) => a.localeCompare(b))
      .at(-1)!,
    files: defaultFiles as Record<string, string>,
  },

  selectors: {
    getFileList: createSelector([state => state.files], files =>
      Object.keys(files).sort((a, b) => a.localeCompare(b)),
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

    fileNavigated: create.reducer<string>((state, action) => {
      state.currentPath = action.payload;
    }),

    fileUpdated: create.reducer<string>((state, action) => {
      state.files[state.currentPath] = action.payload;
    }),
  }),
});

export const { newFile, fileNavigated, fileUpdated } = filesSlice.actions;
export const { getCurrentFile, getFileList } = filesSlice.selectors;

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(
    querySlice.actions.executeAllQueries.fulfilled,
    querySlice.actions.executeQuery.fulfilled,
  ),
  effect: function (_action, listenerApi) {
    listenerApi.dispatch(querySlice.actions.introspectionRequested(null));
  },
});

const rootReducer = combineSlices(uiSlice, filesSlice, querySlice);

const persistConfig = {
  key: "root",
  version: 1,
  storage,
  throttle: 500,
  blacklist: ["queries"],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(listenerMiddleware.middleware);
  },
});

export const persistor = persistStore(store)

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useDispatch = useUntypedDispatch.withTypes<AppDispatch>();
export const useSelector = useUntypedSelector.withTypes<RootState>();
