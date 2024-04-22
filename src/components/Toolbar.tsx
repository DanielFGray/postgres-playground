import clsx from "classnames";
import { executeQuery, useDispatch, useSelector } from "../store";
import { Button, Spinner } from "./";

export function Toolbar({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { pending } = useSelector(state => state.query);
  return (
    <div className={clsx("flex flex-row gap-2 p-2", className)}>
      <span className="grow">
        <Button onClick={() => dispatch(executeQuery(null))} disabled={pending}>
          {pending ? (
            <div className="inline-flex h-4 w-4 items-center">
              <Spinner />
            </div>
          ) : null}
          Run
        </Button>
      </span>
      <span className="shrink space-x-2">
        <Button disabled>Save</Button>
        <Button disabled>Share</Button>
      </span>
    </div>
  );
}
