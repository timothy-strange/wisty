import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => ({
  plugins: [solidPlugin()],
  define: {
    __WISTY_DEBUG__: JSON.stringify(mode !== 'production')
  },
  build: {
    target: 'esnext',
    polyfillDynamicImport: false,
  },
}));
