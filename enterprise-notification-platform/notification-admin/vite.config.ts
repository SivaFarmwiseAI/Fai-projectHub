import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@enterprise/notification-sdk": resolve(
        __dirname,
        "../notification-sdk/src/index.ts"
      ),
    },
  },
  server: {
    port: 3000,
  },
});
