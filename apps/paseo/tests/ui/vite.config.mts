import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: here("./"),
  resolve: { alias: [
    { find: "@getpaseo/plugin/client/react-native", replacement: here("./plugin.tsx") },
    { find: "@getpaseo/plugin/client", replacement: here("./plugin.tsx") },
    { find: "@getpaseo/plugin", replacement: here("./plugin.tsx") },
    { find: "react-native", replacement: "react-native-web" },
  ] },
  server: { host: "127.0.0.1", port: 43198, strictPort: true },
});
