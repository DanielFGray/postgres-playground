import { previewToggled, useDispatch, useSelector } from "~/store";
import type { Result } from "~/types";
import { Button, Error } from "~/components";

export function Result() {
  const previewVisible = useSelector(state => state.ui.previewVisible);
  const result = useSelector(state => state.queries.result);
  const error = useSelector(state => state.queries.error);
  const dispatch = useDispatch();
  return (
    <div className="fixed bottom-0 w-full backdrop-blur-sm">
      <div className="bg-primary-100/80 dark:bg-primary-900/80">
        <div className="p-2 outline outline-1 outline-primary-300 dark:outline-primary-600">
          <Button onPress={() => dispatch(previewToggled())}>Result</Button>
        </div>
        {previewVisible && (
          <>
            {error ? (
              // TODO: show what line it was on
              <Error id="query_error_message">Error: {error.message}</Error>
            ) : result ? (
              <div
                id="preview_container"
                className="max-h-[32dvh] space-y-2 overflow-auto p-2"
              >
                {result instanceof Array ? (
                  result.map(r => <ResultTable result={r} />)
                ) : (
                  <ResultTable result={result} />
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ResultTable({ result }: { result: Result }) {
  return (
    <table className="w-full">
      {result.fields.length < 1 ? null : (
        <thead className="border-b border-primary-300 dark:border-primary-600">
          <tr>
            {result.fields.map(col => (
              <th>{col.name}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody className="divide-y divide-primary-300 dark:divide-primary-600">
        {result.rows.length < 1 ? (
          <tr>
            <td colSpan={result.fields.length}>No results</td>
          </tr>
        ) : (
          result.rows.map(row => (
            <tr>
              {result.fields.map(f => (
                <RowValue value={row[f.name]} typeId={f.dataTypeID} />
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function RowValue({ value, typeId }: { value: any; typeId }) {
  return (
    <td
      className={
        // looks like a number or date
        // FIXME: don't use magic numbers
        typeof value === "number" || typeId === 1184
          ? "text-right"
          : "text-left"
      }
    >
      {typeof value === "string" ? (
        value
      ) : (
        <span className="font-mono">{JSON.stringify(value)}</span>
      )}
    </td>
  );
}
