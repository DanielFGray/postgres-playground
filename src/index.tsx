import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./tailwind.css";
import { Provider } from "react-redux";
import { store } from "./store";

document.addEventListener("DOMContentLoaded", function () {
  const el = document.getElementById("appRoot");
  if (!el) throw new Error("No appRoot element found");
  ReactDOM.createRoot(el).render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
});
