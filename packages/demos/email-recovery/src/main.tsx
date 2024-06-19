import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster
      toastOptions={{
        duration: 5000,
        style: {
          fontSize: "12px",
        },
      }}
    />
  </React.StrictMode>
);
