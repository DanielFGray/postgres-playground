import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { Preview } from "./components/Preview";
import { MonacoEditor as Editor } from "./components/Editor";
import { Toolbar } from "./components/Toolbar";
import { FileBrowser } from "./components/FileBrowser";
import { IntrospectionViewer } from "./components/Introspection";

export function App() {
  return (
    <div className="flex h-full bg-primary-100 text-primary-900 dark:text-primary-100 dark:bg-primary-900 flex-col">
      <Toolbar />
      <div className="flex grow flex-row max-h-[100dvh]">
        <div className="flex flex-col w-[30vw]">
          <FileBrowser />
          <IntrospectionViewer />
        </div>
        <Editor className="grow" />
      </div>
      <Preview />
    </div>
  );
}
