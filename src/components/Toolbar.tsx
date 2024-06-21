import clsx from "classnames";
import { executeAllQueries, useDispatch, useSelector } from "~/store";
import { serverApi } from "~/store.serverApi";
import { Button, Spinner } from "~/components";
import { Toolbar as AriaToolbar, Group } from "react-aria-components";

export function Toolbar({ className }: { className?: string }) {
  const dispatch = useDispatch();
  const { pending } = useSelector(state => state.queries);
  const { data: { body: auth } } = serverApi.useMeQuery({});
  return (
    <AriaToolbar
      className={clsx(
        "flex flex-row items-center justify-between gap-2 p-2",
        className,
      )}
    >
      <Group>
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
      {auth?.id ? <div>hello {auth.username}!</div> : null}
      <Group>
        <Button size="lg" color="primary" isDisabled>
          Save
        </Button>
        <Button size="lg" color="primary" isDisabled>
          Share
        </Button>
        {auth?.id ? null : (
          <Button as="a" href="/auth/github">
            Log In
          </Button>
        )}
      </Group>
    </AriaToolbar>
  );
}
