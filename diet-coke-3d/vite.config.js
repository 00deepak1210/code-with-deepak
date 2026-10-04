import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from any sub-folder
  // (e.g. GitHub Pages at /<repo>/).
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
