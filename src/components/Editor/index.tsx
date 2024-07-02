import clsx from "classnames";
import * as monaco from "monaco-editor";
import ReactMonaco, { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import {
  getCurrentFile,
  executeQuery,
  fileUpdated,
  useDispatch,
  useSelector,
} from "~/store";
import { useMediaQuery } from "react-responsive";
import { completionService } from "./completionService";

loader.config({ monaco });

// @ts-expect-error TODO: figure out how to type globalThis
globalThis.MonacoEnvironment = {
  getWorker(_, label) {
    return new editorWorker();
  },
};

monaco.languages.registerCompletionItemProvider("sql", {
  async provideCompletionItems(monaco, position, context, token) {
    console.log("provideCompletionItems", position, context, token);
    return {  }
  },
});

export function Editor({ className }: { className?: string }) {
  const currentFile = useSelector(getCurrentFile);
  const preferDarkMode = useMediaQuery({
    query: "(prefers-color-scheme: dark)",
  });
  const dispatch = useDispatch();

  return (
    <ReactMonaco
      className={clsx(
        "border-1 overflow-clip border border-primary-300 dark:border-primary-600",
        className,
      )}
      defaultLanguage="sql"
      path={currentFile.path}
      defaultValue={currentFile.value}
      options={{
        automaticLayout: true,
        minimap: { autohide: true },
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
