import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { Preview } from "./components/Preview";
import { MonacoEditor as Editor } from "./components/Editor";

export function App() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-grow flex-row">
        <Editor className="flex-grow" />
      </div>
      <Preview />
    </div>
  );
}
