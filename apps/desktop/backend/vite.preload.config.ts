import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: 'src/preload.ts',
            formats: ['iife'],
            name: 'Preload'
        },
        outDir: 'dist/preload',
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: 'index.js'
            }
        }
    }
})
