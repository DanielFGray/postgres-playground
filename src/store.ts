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
    previewVisible: true,
    introspectionVisible: true,
  },

  reducers: create => ({
    introspectionToggled: create.reducer(state => {
      state.introspectionVisible = !state.introspectionVisible;
    }),

    previewToggled: create.reducer(state => {
      state.previewVisible = !state.previewVisible;
    }),
    queryExecuted: create.reducer(state => {
      state.previewVisible = true;
    }),
  }),
});

export const { previewToggled, filebarToggled, introspectionToggled } = uiSlice.actions;

const querySlice = createSlice({
  name: "query",
  initialState: {
    query: null as null | string,
    result: null as null | Result | Result[],
    plan: null as null | string,
    error: null as null | SerializedError,
    introspection: null as null | Record<string, DbSchema>,
    pending: false,
  },

  reducers: create => ({
    queryExecuted: create.reducer<{ query: string; result: Result[] }>(
      (state, action) => {
        state.query = action.payload.query;
        state.result = action.payload.result;
      },
    ),

    queryChanged: create.reducer<string>((state, action) => {
      state.query = action.payload;
    }),

    introspectionRequested: create.asyncThunk(db.introspectDb, {
      fulfilled: (state, action) => {
        state.introspection = action.payload.schemas;
      },
    }),

    executeQuery: create.asyncThunk(
      async (_, { getState, dispatch }) => {
        // @ts-ignore
        const { query } = getState().query;
        try {
          const result = await db.query(query);
          return result;
        } finally {
          dispatch(uiSlice.actions.queryExecuted());
          dispatch(querySlice.actions.introspectionRequested(null));
        }
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

export const { executeQuery, queryChanged } = querySlice.actions;

const rootReducer = combineSlices(uiSlice, querySlice);
export const store = configureStore({ reducer: rootReducer });

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useDispatch = useUntypedDispatch.withTypes<AppDispatch>();
export const useSelector = useUntypedSelector.withTypes<RootState>();
