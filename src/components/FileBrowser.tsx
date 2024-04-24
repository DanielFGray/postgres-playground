import { useState } from "react";
import clsx from "classnames";
import { classed } from "@tw-classed/react";
import {
  getFileList,
  useSelector,
  useDispatch,
  currentFileChanged,
  newFile,
  getCurrentFile,
} from "../store";
import { Button } from ".";

export const FileNode = classed(
  "button",
  "tracking-light block w-full p-1 text-left text-sm outline-1 outline-primary-300 hover:outline",
  {
    variants: {
      state: {
        selected: 'bg-primary-700 text-primary-50 pointer-events-none',
        default: 'bg-transparent bg-primary-50 text-primary-900',
      }
    },
    defaultVariants: {
      state: 'default'
    },
  },
);

function NewFileButton() {
  const [inputVisible, setInputVisible] = useState(false);
  const dispatch = useDispatch();
  if (inputVisible) {
    return (
      <form
        onSubmit={ev => {
          dispatch(newFile(ev.currentTarget.filename.value));
          setInputVisible(false);
        }}
      >
        <input
          type="text"
          name="filename"
          placeholder="filename"
          className="block w-full border-transparent outline-primary-300 p-2 outline outline-1 hover:outline"
        />
      </form>
    );
  }
  return (
    <Button className="w-full" onClick={() => setInputVisible(true)}>
      New File
    </Button>
  );
}

export function FileBrowser({ className }: { className?: string }) {
  const files = useSelector(getFileList);
  // const visible = useSelector(state => state.ui.filesVisible)
  const { path } = useSelector(getCurrentFile);
  const dispatch = useDispatch();
  return (
    <aside
      className={clsx(
        "space-y-2 px-2",
        className,
      )}
    >
      <ul className="bg-white p-2 outline outline-1 outline-primary-300">
        {files.map(file => (
          <FileNode
            key={file}
            onClick={() => dispatch(currentFileChanged(file))}
            state={file === path ? 'selected' : 'default'}
          >
            {file}
          </FileNode>
        ))}
      </ul>
      <NewFileButton />
    </aside>
  );
}
