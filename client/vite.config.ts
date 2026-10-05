import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5600,
    strictPort: true,
    // Permite abrir el front desde el reenvío de puertos de VS Code (Dev Tunnels).
    allowedHosts: ['.devtunnels.ms'],
    // La carpeta está en OneDrive: sin polling, Vite a veces no detecta los cambios.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': 'http://localhost:4600',
    },
  },
})
