import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.ts'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'dev-manifest-host-permissions',
      closeBundle() {
        if (mode !== 'development') return;
        const manifestPath = resolve(__dirname, 'dist/manifest.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifest.host_permissions ??= [];
        if (!manifest.host_permissions.includes('http://localhost:3000/*')) {
          manifest.host_permissions.push('http://localhost:3000/*');
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
        }
      },
    },
  ],
  publicDir: 'public',
}));
