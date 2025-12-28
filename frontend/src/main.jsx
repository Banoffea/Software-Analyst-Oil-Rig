import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from './utils/auth.jsx';
import App from "./App.jsx";
import "./styles.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>

);
