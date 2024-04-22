import * as monaco from "monaco-editor";
import ReactMonaco from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import PGSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";
import { executeQuery, queryChanged, useDispatch } from "../store";
import clsx from "classnames";
import { useRef } from "react";

// @ts-expect-error TODO: figure out how to type globalThis
globalThis.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "sql") {
      return new PGSQLWorker();
    }
    return new editorWorker();
  },
};

const lastQuery =
  typeof window !== "undefined" &&
  window.localStorage.getItem("pgfiddle-last-query")

export function MonacoEditor({ className }: { className?: string }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const dispatch = useDispatch();

  const defaultQuery = lastQuery || `
-- welcome to pgfiddle, a browser-based playground for postgresql
select
  'hello world' as message,
  generate_series(20, 200, 50)
;
explain analyze
select
  'hello world' as message,
  generate_series(20, 200, 50)
;
`.trim();

  return (
    <ReactMonaco
      className={clsx(className)}
      defaultLanguage="pgsql"
      defaultValue={defaultQuery}
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 18,
      }}
      onMount={(editor, monaco) => {
        dispatch(queryChanged(editor.getValue()));
        editor.getModel()?.onDidChangeContent(event => {
          dispatch(queryChanged(editor.getValue()));
        });
        editor.addAction({
          id: "run-query",
          label: "Run Query",
          contextMenuOrder: 0,
          contextMenuGroupId: "2_commands",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run(e) {
            const query = e.getValue();
            dispatch(executeQuery(query));
          },
        });
        editorRef.current = editor;
      }}
    />
  );
}
