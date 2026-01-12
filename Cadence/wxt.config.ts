import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => {
    if (browser === "chrome" || browser === "edge") {
      return {
        permissions: ["storage", "notifications", "offscreen"],
        optional_permissions: ["tabs"],
        optional_host_permissions: ["https://api.groundedmomentum.com/*"],
        commands: {
          _execute_action: {
            suggested_key: {
              default: "Ctrl+Shift+Y",
              mac: "Command+Shift+Y",
            },
            description: "Open Cadence timer popup",
          },
        },
      };
    } else {
      // Firefox MV2
      return {
        permissions: ["storage", "*://www.instagram.com/*"],
        optional_permissions: ["tabs", "https://api.groundedmomentum.com/*"],
        commands: {
          _execute_browser_action: {
            suggested_key: {
              default: "Ctrl+Shift+Y",
              mac: "Command+Shift+Y",
            },
            description: "Open Cadence timer popup",
          },
        },
      };
    }
  },
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
