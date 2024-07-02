import { Result } from "~/components/Result";
import { MonacoEditor as Editor } from "~/components/Editor";
import { Toolbar } from "~/components/Toolbar";
import { FileBrowser } from "~/components/FileBrowser";
import { IntrospectionViewer } from "~/components/Introspection";

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <Toolbar />
      <div className="flex grow flex-row max-h-dvh">
        <div className="flex flex-col w-[30vw]">
          <FileBrowser />
          <IntrospectionViewer />
        </div>
        <Editor className="grow" />
      </div>
      <Result />
    </div>
  );
}
