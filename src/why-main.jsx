import React from "react";
import ReactDOM from "react-dom/client";
import WhyPage from "./screens/WhyPage.jsx";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WhyPage />
  </React.StrictMode>
);
