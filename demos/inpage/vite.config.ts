import path from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const defaultConfig = {
  plugins: [react()],
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  if (process.env.BUILD_GLOBAL_SCRIPT) {
    return {
      ...defaultConfig,
      build: {
        lib: {
          entry: path.resolve(
            path.dirname(import.meta.url.slice('file://'.length)),
            './src/global.ts',
          ),
          formats: ['iife'],
          name: 'WaxInPage',
          fileName: 'waxInPage',
        },
        outDir: 'build/globalScript',
      },
    };
  }

  return {
    ...defaultConfig,
    build: {
      outDir: 'build/demo',
    },
  };
});
