import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { Preview } from "./components/Preview";
import { MonacoEditor as Editor } from "./components/Editor";
import { Toolbar } from "./components/Toolbar";
import { IntrospectionViewer } from "./components/Introspection";

export function App() {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex grow flex-row max-h-[100dvh]">
        <div className="flex flex-col">
          <IntrospectionViewer />
        </div>
        <Editor className="grow" />
      </div>
      <Preview />
    </div>
  );
}
