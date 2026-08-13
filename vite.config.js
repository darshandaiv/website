import { defineConfig } from 'vite';

export default defineConfig({
  // This matches your GitHub Pages subfolder url structure
  base: './', 
  build: {
    outDir: 'dist',
  }
});
