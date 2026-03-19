import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // Bundle workspace packages into the output so the published npm package
  // has no @termchess/* dependencies and works as a standalone install.
  noExternal: ['@termchess/core', '@termchess/protocol'],
});
