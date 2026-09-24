import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ── Fix cache corrompu / chunk manquant ─────────────────────
  optimizeDeps: {
    include: [
      'jspdf',
      'react',
      'react-dom',
      'lucide-react',
      'date-fns',
    ],
    // Exclure les libs qui causent des conflits avec l'optimizer
    exclude: [],
    // Force la re-génération des deps à chaque démarrage
    // (mettre à false une fois stable pour accélérer le démarrage)
    force: false,
  },

  // ── Serveur dev ──────────────────────────────────────────────
  server: {
    port: 5173,
    strictPort: false,
    // Proxy vers le backend Express
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ── Build ────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Sépare les gros vendors pour éviter les chunks trop lourds
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          pdf:     ['jspdf'],
          icons:   ['lucide-react'],
        },
      },
    },
  },

  // ── Résolution des modules ───────────────────────────────────
  resolve: {
    alias: {
      // Nécessaire pour jsPDF sur certaines configs Windows
      canvas: false,
    },
  },
});