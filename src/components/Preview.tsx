import { previewToggled, useDispatch, useSelector } from "../store";
import type { Result } from "../types";
import { Button, Error } from "./";

export function Preview() {
  const previewVisible = useSelector(state => state.ui.previewVisible);
  const result = useSelector(state => state.query.result);
  const error = useSelector(state => state.query.error);
  const dispatch = useDispatch();
  return (
    <div className="fixed bottom-0 w-full backdrop-blur-sm">
      <div className="bg-primary-100/80">
        <div className="border-b border-primary-300 p-2">
          <Button onClick={() => dispatch(previewToggled())}>Result</Button>
        </div>
        {previewVisible && (
          <>
            {error ? (
              // TODO: show what line it was on
              <Error id="error_message">Error: {error.message}</Error>
            ) : result ? (
              <div id="preview_container" className="max-h-[32dvh] overflow-auto space-y-2 p-2">
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
  if (!result.rows.length) return <div>No results</div>;
  return (
    <table className="w-full">
      <thead>
        <tr>
          {result.fields.map(col => (
            <th>{col.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.rows.map(row => (
          <tr className="odd:bg-primary-700/10">
            {result.fields.map((f, i) => {
              const value = row[f.name];
              return <RowValue value={value} />;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RowValue({ value }: { value: any }) {
  return (
    <td className={typeof value === "number" ? "text-right" : "text-left"}>
      {typeof value === "string" ? (
        value
      ) : (
        <span className="font-mono">{JSON.stringify(value)}</span>
      )}
    </td>
  );
}
