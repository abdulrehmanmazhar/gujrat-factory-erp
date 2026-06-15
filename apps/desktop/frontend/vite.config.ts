import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        {
            name: 'neutralino-injector',
            transformIndexHtml(html) {
                console.log('Injecting Neutralino config if applicable...')

                const jsonPath = path.join(import.meta.dirname, '../', 'backend', '.tmp', 'auth_info.json')

                const env = loadEnv(mode, process.cwd(), '') as unknown as Record<'VITE_CTXT', 'NEUTRALINO' | 'CAPACITOR' | 'WEB'>

                if (env.VITE_CTXT !== 'NEUTRALINO') return html

                console.log(`Looking for config at ${jsonPath}`)

                try {
                    const data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
                        nlConnectToken: string
                        nlPort: number
                        nlToken: string
                    }
                    const script = `<script src="http://localhost:${data.nlPort}/__neutralino_globals.js">window.NL_TOKEN = ${data.nlToken} window.NL_CONNECT_TOKEN = ${data.nlConnectToken}</script>`

                    return html.replace('<script>', `${script}\n<script>`)
                } catch {
                    console.warn('Could not find or parse config for injection')
                    return html
                }
            }
        }
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    }
}))
