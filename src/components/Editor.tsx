import ReactMonaco from "@monaco-editor/react";
import PGSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";
import { executeQuery, queryChanged, useDispatch } from "../store";
import clsx from "classnames";

// @ts-expect-error TODO: figure out how to type globalThis
globalThis.MonacoEnvironment = {
  getWorker() {
    return new PGSQLWorker();
  },
};

export const defaultQuery =
  "select 'hello world' as message, generate_series(20, 200, 50);";

export function MonacoEditor({ className }: { className?: string }) {
  const dispatch = useDispatch();

  return (
    <ReactMonaco
      className={clsx(className)}
      defaultLanguage="pgsql"
      defaultValue={defaultQuery}
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
      }}
      onMount={(editor, monaco) => {
        editor.addAction({
          id: "run-query",
          label: "Run Query",
          contextMenuOrder: 0,
          contextMenuGroupId: "2_commands",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run(e) {
            const query = e.getValue();
            dispatch(queryChanged(query));
            dispatch(executeQuery(query));
          },
        });
      }}
    />
  );
}
