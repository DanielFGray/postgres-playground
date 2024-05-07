import clsx from "classnames";
import {
  useSelector,
  // useDispatch,
} from "../store";
import { Stringify } from ".";

export function IntrospectionViewer({ className }: { className?: string }) {
  // const visible = useSelector(state => state.ui.introspectionVisible)
  const introspection = useSelector(state => state.queries.introspection);
  // const dispatch = useDispatch();
  if (!introspection) return null;
  return (
    <aside className={clsx("overflow-auto p-2", className)}>
      <pre className="p-2 border border-primary-300 dark:border-primary-600">
        {JSON.stringify(introspection, null, 2)}
      </pre>
    </aside>
  );
}
