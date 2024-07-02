import { createBrowserRouter } from "react-router-dom";
import * as App from "~/app";

const routeMap = {
  "/": App,
  "/playground/:id": App,
};
export const router = createBrowserRouter(
  Object.entries(routeMap).map(
    ([path, { default: Component, action, loader }]) => ({
      path,
      Component,
      action,
      loader,
    }),
  ),
  {},
);
