import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lets the admin run at a domain root or a sub-path (GitHub Pages "/arnygym/admin/").
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  base: BASE,
  plugins: [react()],
  // Admin sessions are tab-scoped (sessionStorage) — see src/lib/supabase.ts.
  define: { 'import.meta.env.VITE_ADMIN_APP': JSON.stringify('1') },
});
