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
    <aside className={clsx("pt-2 overflow-auto", className)}>
      <div>
        {Stringify(introspection)}
      </div>
    </aside>
  );
}
