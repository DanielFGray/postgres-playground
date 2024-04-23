import clsx from "classnames";
import {
    useSelector,
  // useDispatch,
} from "../store";
import { Stringify } from ".";

export function IntrospectionViewer({ className }: { className?: string }) {
  // const visible = useSelector(state => state.ui.introspectionVisible)
  const introspection = useSelector(state => state.query.introspection);
  // const dispatch = useDispatch();
  if (!introspection) return null;
  return (
    <aside className={clsx("overflow-auto bg-primary-900 text-primary-200", className)}>
      <div>
        {Stringify(introspection)}
      </div>
    </aside>
  );
}
