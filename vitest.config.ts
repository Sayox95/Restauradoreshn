import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Los mismos alias que la app, para probar módulos del navegador que no dependen del DOM
  // (p. ej. la ficha PDF).
  resolve: {
    alias: {
      '@shared': resolve(process.cwd(), 'shared'),
      '@components': resolve(process.cwd(), 'src/common/components'),
      '@common': resolve(process.cwd(), 'src/common'),
      '@modules': resolve(process.cwd(), 'src/app/modules'),
      '@': resolve(process.cwd(), 'src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
