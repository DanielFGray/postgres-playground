import { useRef } from "react";
import clsx from "classnames";
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import ReactMonaco from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import PGSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";
import {
  setupLanguageFeatures,
  LanguageIdEnum,
} from "monaco-sql-languages";
import {
  getCurrentFile,
  executeQuery,
  fileUpdated,
  useDispatch,
  useSelector,
} from "../../store";
import { useMediaQuery } from "react-responsive";
import { completionService } from "./completionService";

loader.config({ monaco });

// @ts-expect-error TODO: figure out how to type globalThis
globalThis.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "sql") {
      return new PGSQLWorker();
    }
    return new editorWorker();
  },
};

setupLanguageFeatures(LanguageIdEnum.PG, {
  completionItems: {
    enable: true,
    completionService,
  },
});

export function MonacoEditor({ className }: { className?: string }) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const currentFile = useSelector(getCurrentFile);
  const preferDarkMode = useMediaQuery({
    query: "(prefers-color-scheme: dark)",
  });
  const dispatch = useDispatch();

  return (
    <ReactMonaco
      className={clsx(
        "overflow-clip border border-1 border-primary-300 dark:border-primary-600",
        className,
      )}
      defaultLanguage="pgsql"
      path={currentFile.path}
      defaultValue={currentFile.value}
      options={{
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 15,
      }}
      theme={preferDarkMode ? "vs-dark" : "light"}
      onMount={(editor, monaco) => {
        dispatch(fileUpdated(editor.getValue()));
        editor.getModel()?.onDidChangeContent(event => {
          dispatch(fileUpdated(editor.getValue()));
        });
        editor.addAction({
          id: "run-query",
          label: "Run Query",
          contextMenuOrder: 0,
          contextMenuGroupId: "2_commands",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run(e) {
            const model = e.getModel();
            const selection = editor.getSelection();
            const query =
              (selection && model?.getValueInRange(selection)) ||
              model?.getValue();
            console.log("Running query", query);
            dispatch(executeQuery(query));
          },
        });
        editorRef.current = editor;
      }}
    />
  );
}
