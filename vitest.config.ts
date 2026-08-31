import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Fuseau horaire Los Angeles (UTC-7/8) pour détecter les régréssions d'ancrage de dates.
    // Les dates ISO sont interprétées comme minuit UTC par new Date(iso), ce qui sur un fuseau
    // en avance sur UTC (Europe) donne le jour correct, mais sur un fuseau en retard (Amériques, Pacifique)
    // donne le jour précédent. Fixer le fuseau à LA garantit que le test échouerait si on remplaçait
    // parseISO (qui interprète correctement en local) par new Date (qui interprète en UTC).
    env: { TZ: 'America/Los_Angeles' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
