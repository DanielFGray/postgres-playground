import ReactDOM from "react-dom/client";
import { App } from "~/app";
import "~/tailwind.css";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { RouterProvider } from "react-router-dom";
import { persistor, store } from "~/store";
import { router } from "~/routes";

document.addEventListener("DOMContentLoaded", function () {
  const el = document.getElementById("appRoot");
  if (!el) throw new Error("No appRoot element found");
  ReactDOM.createRoot(el).render(
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <RouterProvider router={router} />
      </PersistGate>
    </Provider>,
  );
});
