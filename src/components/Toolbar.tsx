import clsx from "classnames";
import { executeQuery, useDispatch, useSelector } from "../store";
import { Button, Spinner } from "./";

export function Toolbar({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { pending } = useSelector(state => state.query);
  return (
    <div className={clsx("flex flex-row flex-wrap gap-2 p-2", className)}>
      <Button
        onClick={() => {
          dispatch(executeQuery(null));
        }}
        disabled={pending}
      >
        {pending ? (
          <div className="inline-flex h-4 w-4 items-center">
            <Spinner />
          </div>
        ) : null}
        Run
      </Button>
      <Button
        onClick={() => {
          // dispatch(saveQuery())
        }}
      >
        Save
      </Button>
    </div>
  );
}
