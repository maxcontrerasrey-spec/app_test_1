import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var has = function (segment) { return id.indexOf(segment) !== -1; };
                    if (has("/node_modules/recharts/")) {
                        return "recharts-vendor";
                    }
                    if (has("/node_modules/@mylinkpi/xlsx/")) {
                        return "xlsx-vendor";
                    }
                    if (has("/node_modules/react/") ||
                        has("/node_modules/react-dom/") ||
                        has("/node_modules/react-router-dom/") ||
                        has("/node_modules/@tanstack/")) {
                        return "app-framework";
                    }
                    if (has("/node_modules/@supabase/supabase-js/")) {
                        return "supabase-vendor";
                    }
                    if (has("/node_modules/react-markdown/") ||
                        has("/node_modules/remark-gfm/")) {
                        return "markdown-vendor";
                    }
                    return undefined;
                }
            }
        }
    }
});
