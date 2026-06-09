import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ORIONProvider } from "./modules/ai_assistant/context/ORIONContext";
import { AuthProvider } from "./modules/auth/context/AuthContext";
import { ThemeProvider } from "./shared/context/ThemeContext";
import { queryClient } from "./shared/lib/queryClient";
import { AppErrorBoundary } from "./shared/ui/AppErrorBoundary";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <ORIONProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ORIONProvider>
          </AuthProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
