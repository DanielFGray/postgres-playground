import { useMemo, useState } from "react";
import clsx from "classnames";
import {
  getFileList,
  useSelector,
  useDispatch,
  currentFileChanged,
  newFile,
  getCurrentFile,
} from "../store";
import {
  Input,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { Button } from ".";

export function FileBrowser({ className }: { className?: string }) {
  const [inputVisible, setInputVisible] = useState(false);

  const dispatch = useDispatch();
  const fileList = useSelector(getFileList);
  const visible = useSelector(state => state.ui.filebarVisible);
  const { path } = useSelector(getCurrentFile);
  const files = useMemo(
    () => fileList.map(file => ({ id: file })),
    [fileList],
  );
  return (
    <aside
      className={clsx(
        "space-y-2 px-2",
        visible ? "block" : "hidden",
        className,
      )}
    >
      <ListBox
        selectionMode="single"
        aria-label="files in this fiddle"
        onSelectionChange={selection => {
          if (typeof selection === "string") {
            return dispatch(currentFileChanged(selection));
          }
          for (const item of selection) {
            return dispatch(currentFileChanged(item));
          }
        }}
        selectedKeys={[path]}
        className="bg-white p-2 text-sm outline outline-1 outline-primary-300"
        items={files}
      >

        {file => (
          <ListBoxItem
            className={({ isSelected }) =>
              clsx(
                isSelected
                  ? "pointer-events-none bg-primary-700 text-primary-50"
                  : "bg-primary-50 bg-transparent text-primary-900",
                "tracking-light block w-full p-1 text-left text-sm outline-1 outline-primary-300 hover:outline",
              )
            }
            key={file.id}
          >
            {file.id}
          </ListBoxItem>
        )}

      </ListBox>
      {inputVisible ? (
        <form
          onSubmit={ev => {
            const name = ev.currentTarget.filename.value;
            if (name?.length > 0) {
              dispatch(newFile(name));
            }
            setInputVisible(false);
          }}
        >
          <Input
            type="text"
            autoFocus
            name="filename"
            placeholder="filename"
            className="block w-full border-transparent p-2 outline outline-1 outline-primary-300 hover:outline"
          />
        </form>
      ) : (
        <Button className="w-full" onPress={() => setInputVisible(true)}>
          New File
        </Button>
      )}
    </aside>
  );
}
