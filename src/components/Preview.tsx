import { useSelector } from "../store";
import type { Result } from "../types";
import { Error } from "./";

export function Preview() {
  const result = useSelector(state => state.query.result);
  const error = useSelector(state => state.query.error);
  return (
    <div className="fixed bottom-0 w-full p-2 max-h-[50dvh]">
      {error ? (
        /* TODO: what line was it on?? */
        <Error id="error_message">Error: {error.message}</Error>
      ) : result ? (
        <div id="preview_container" className="space-y-4">
          {result instanceof Array ? (
            result.map((r, i) => <ResultTable result={r} />)
          ) : (
            <ResultTable result={result} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultTable({ result }: { result: Result }) {
  if (!result.rows.length) return <div>No results</div>;
  return (
    <table className="w-full">
      <thead className="bg-primary-100">
        <tr>
          {result.fields.map(col => (
            <th>{col.name}</th>
          ))}
        </tr>
      </thead>
      <tbody className="overflow-auto">
        {result.rows.map(row => (
          <tr>
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
      {typeof value === "string" ? value : <span className="font-mono">{JSON.stringify(value)}</span>}
    </td>
  );
}
