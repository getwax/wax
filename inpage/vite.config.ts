import path from 'path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig(() => {
  if (process.env.LIB) {
    return {
      plugins: [react()],
      build: {
        lib: {
          entry: path.resolve(
            path.dirname(import.meta.url.slice('file://'.length)),
            './src/index.ts',
          ),
          name: 'WaxInPage',
          fileName: 'inpage',
        }
      }
    };
  }

  return {
    plugins: [react()],
  };
});
