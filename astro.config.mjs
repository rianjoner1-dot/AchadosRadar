import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
// Modo estático (SSG) de máxima performance e zero custo na Vercel
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  build: {
    format: 'directory'
  }
});
