import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
// Bundles entry.tsx for node with the SDK and react-native replaced by stubs;
// React itself stays external so the development build (named hook-order
// warnings) is the one that runs.
export default defineConfig({
  root: here("./"),
  mode: "development",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  resolve: { alias: [
    { find: "@getpaseo/plugin/client/react-native", replacement: here("./stubs/plugin.tsx") },
    { find: "@getpaseo/plugin/client/ui", replacement: here("./stubs/plugin.tsx") },
    { find: "@getpaseo/plugin/client", replacement: here("./stubs/plugin.tsx") },
    { find: "@getpaseo/plugin", replacement: here("./stubs/plugin.tsx") },
    { find: "react-native", replacement: here("./stubs/react-native.tsx") },
  ] },
  build: {
    lib: { entry: here("./entry.tsx"), formats: ["es"], fileName: () => "entry.mjs" },
    outDir: here("../../node_modules/.cache/hook-order"),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: { external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-test-renderer", "@tanstack/react-query", "use-sync-external-store/shim/with-selector", "zod"] },
  },
  logLevel: "warn",
});
