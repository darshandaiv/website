import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/',

  build: {
    outDir: 'dist',
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