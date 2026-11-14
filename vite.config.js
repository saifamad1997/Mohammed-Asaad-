import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['opencascade.js']
  },
  build: {
    target: 'es2022'
  }
});
