import clsx from "classnames";
import { executeAllQueries, useDispatch, useSelector } from "~/store";
import { Button, Spinner } from "~/components";
import { Toolbar as AriaToolbar, Group } from "react-aria-components";

export function Toolbar({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { pending } = useSelector(state => state.queries);
  return (
    <AriaToolbar className={clsx("flex flex-row gap-2 p-2", className)}>
      <Group className="grow">
        <Button
          color="primary"
          size="lg"
          onPress={() => dispatch(executeAllQueries(null))}
          isDisabled={pending}
        >
          {pending ? (
            <Spinner className="inline-flex h-4 w-4 items-center" />
          ) : null}
          Run All
        </Button>
      </Group>
      <Group className="shrink space-x-2">
        <Button size="lg" color="primary" isDisabled>
          Save
        </Button>
        <Button size="lg" color="primary" isDisabled>
          Share
        </Button>
      </Group>
    </AriaToolbar>
  );
}
