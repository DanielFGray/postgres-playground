import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { Preview } from "./components/Preview";
import { MonacoEditor as Editor } from "./components/Editor";
import { Toolbar } from "./components/Toolbar";

export function App() {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <Editor className="flex-grow" />
      <Preview />
    </div>
  );
}
