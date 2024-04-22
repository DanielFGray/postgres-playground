import clsx from "classnames";
import { useDispatch, useSelector } from "../store";

export function Sidebar() {
  const sidebarVisible = useSelector(state => state.query?.visible)
  const dispatch = useDispatch();
  return <aside className={clsx(sidebarVisible ? 'block' : 'hidden')}></aside>;
}
