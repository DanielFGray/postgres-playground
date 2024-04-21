import {
  useDispatch as useUntypedDispatch,
  useSelector as useUntypedSelector,
} from "react-redux";
import {
  configureStore,
  buildCreateSlice,
  asyncThunkCreator,
  SerializedError,
} from "@reduxjs/toolkit";
import * as db from "./db";
import { Result } from "./types";

const createSlice = buildCreateSlice({
  creators: { asyncThunk: asyncThunkCreator },
});

const queryReducer = createSlice({
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
      async (_, { getState }) => {
        // @ts-ignore
        const { query } = getState().query;
        const result = await db.query(query);
        return result
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

export const { executeQuery, queryChanged } = queryReducer.actions;

export const store = configureStore({
  reducer: { query: queryReducer.reducer },
});

type RootState = ReturnType<typeof store.getState>;
type AppDispatch = typeof store.dispatch;

export const useDispatch = useUntypedDispatch.withTypes<AppDispatch>();
export const useSelector = useUntypedSelector.withTypes<RootState>();
