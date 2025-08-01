import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => ({
    permissions: [
      "storage",
      "notifications",
      // Only include offscreen permission for Chrome and Edge
      ...(browser === 'chrome' || browser === 'edge' ? ['offscreen'] : [])
    ],
    optional_permissions: [
      "tabs"
    ],
    commands: {
      ...(browser === 'firefox' ? {
        "_execute_browser_action": {
          "suggested_key": {
            "default": "Ctrl+Shift+Y",
            "mac": "Command+Shift+Y"
          },
          "description": "Open Cadence timer popup"
        }
      } : {
        "_execute_action": {
          "suggested_key": {
            "default": "Ctrl+Shift+Y",
            "mac": "Command+Shift+Y"
          },
          "description": "Open Cadence timer popup"
        }
      })
    }
  }),
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()]
  })
});