import clsx from "classnames";
import { executeQuery, useDispatch, useSelector } from "../store";
import { Button, Spinner } from "./";
import { Toolbar as AriaToolbar, Group } from 'react-aria-components'

export function Toolbar({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { pending } = useSelector(state => state.queries);
  return (
    <AriaToolbar className={clsx("flex flex-row gap-2 bg-primary-100 p-2", className)}>
      <Group className="grow">
        <Button
          size="lg"
          onPress={() => dispatch(executeQuery())}
          isDisabled={pending}
        >
          {pending ? (
            <div className="inline-flex h-4 w-4 items-center">
              <Spinner />
            </div>
          ) : null}
          Run
        </Button>
      </Group>
      <Group className="shrink space-x-2">
        <Button size="lg" isDisabled>Save</Button>
        <Button size="lg" isDisabled>Share</Button>
      </Group>
    </AriaToolbar>
  );
}
