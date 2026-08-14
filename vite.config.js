import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Keep this as '/' because your custom domain serves from the direct root!
  base: '/', 

  build: {
    outDir: 'dist',
    // Bypasses the 500kB strict warning block since you are loading multiple independent assets
    chunkSizeWarningLimit: 1000, 
    
    // Note: Vite 8 relies on Rolldown engine optimizations instead of rollupOptions for internal logic
    rolldownOptions: {
      output: {
        // Activates cleaner bundle grouping strategy per the Rolldown recommendation
        codeSplitting: true 
      }
    },
    
    rollupOptions: {
      input: {
        // Root Pages
        main: resolve(__dirname, 'index.html'),
        hello: resolve(__dirname, 'hello.html'),
        playbook: resolve(__dirname, 'playbook.html'),
        expedition: resolve(__dirname, 'expedition.html'),
        404: resolve(__dirname, '404.html'),

        // Pages inside the 'projects' folder
        projects_index: resolve(__dirname, 'projects/index.html'),
        dantaushadhi: resolve(__dirname, 'projects/dantaushadhi.html'),
        fluent_design: resolve(__dirname, 'projects/fluent-design.html'),
        nimbus_08: resolve(__dirname, 'projects/nimbus-08.html'),
        origami_shores: resolve(__dirname, 'projects/origami-shores.html'),
        oroma: resolve(__dirname, 'projects/oroma.html'),
        void_one_ui: resolve(__dirname, 'projects/void-one-ui.html'),
      },
    },
  },
});
