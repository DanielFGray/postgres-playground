import { useMemo, useState } from "react";
import clsx from "classnames";
import {
  getFileList,
  useSelector,
  useDispatch,
  fileNavigated,
  newFile,
  getCurrentFile,
} from "../store";
import { ListBox, ListBoxItem } from "react-aria-components";
import { Input, Button } from ".";

export function FileBrowser({ className }: { className?: string }) {
  const [inputVisible, setInputVisible] = useState(false);

  const visible = useSelector(state => state.ui.filebarVisible);
  const { path } = useSelector(getCurrentFile);
  const fileList = useSelector(getFileList);
  const dispatch = useDispatch();

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
          if (typeof selection === "string") return
          for (const item of selection) {
            return dispatch(fileNavigated(item));
          }
        }}
        selectedKeys={[path]}
        className="bg-white p-2 outline outline-1 outline-primary-300 dark:bg-primary-700/50 dark:outline-primary-600"
        items={files}
      >
        {file => (
          <ListBoxItem
            className={({ isSelected }) =>
              clsx(
                isSelected
                  ? "pointer-events-none bg-primary-700 text-primary-50"
                  : "bg-primary-50 bg-transparent text-primary-900 dark:text-primary-200",
                "tracking-light block w-full p-1 text-left text-xs outline-1 outline-primary-300 hover:outline dark:outline-primary-600",
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
            autoFoclus
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
