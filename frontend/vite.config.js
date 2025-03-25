import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.tmj'],
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.tmj']
  }
})
