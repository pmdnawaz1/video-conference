import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";

createRoot(document.getElementById("root")).render(
  // Temporarily disable StrictMode to fix double WebSocket connections
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
