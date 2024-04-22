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
} from "@reduxjs/toolkit";
import * as db from "./db";
import { Result } from "./types";

const createSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    sidebarVisible: true,
    previewVisible: false,
  },
  reducers: create => ({
    sidebarToggled: create.reducer(state => {
      state.sidebarVisible = !state.sidebarVisible;
    }),
    previewToggled: create.reducer(state => {
      state.previewVisible = !state.previewVisible;
    }),
    queryExecuted: create.reducer(state => {
      state.previewVisible = true;
    }),
  }),
});

export const { sidebarToggled, previewToggled } = uiSlice.actions;

const querySlice = createSlice({
  name: "query",
  initialState: {
    query: null as null | string,
    result: null as null | Result | Result[],
    plan: null as null | string,
    error: null as null | SerializedError,
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

    executeQuery: create.asyncThunk(
      async (_, { getState, dispatch }) => {
        // @ts-ignore
        const { query } = getState().query;
        try {
          const result = await db.query(query);
          return result;
        } finally {
          dispatch(uiSlice.actions.queryExecuted());
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
