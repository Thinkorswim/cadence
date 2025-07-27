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
    ]
  }),
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()]
  })
});