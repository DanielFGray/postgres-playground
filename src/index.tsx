import ReactDOM from "react-dom/client";
import { App } from "./app";
import "./tailwind.css";
import { Provider } from "react-redux";
import { store } from "./store";

ReactDOM.createRoot(document.getElementById("appRoot")).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
