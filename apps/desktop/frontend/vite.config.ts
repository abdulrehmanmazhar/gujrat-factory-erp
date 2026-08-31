import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiServer = env.VITE_SERVER_URL || 'http://localhost:8080'

    return {
        plugins: [
            react(),
            babel({ presets: [reactCompilerPreset()] }),
            tailwindcss(),
            {
                name: 'neutralino-injector',
                transformIndexHtml(html) {
                    const viteEnv = env as unknown as Record<'VITE_CTXT', 'NEUTRALINO' | 'CAPACITOR' | 'WEB'>
                    if (viteEnv.VITE_CTXT !== 'NEUTRALINO') return html

                    const jsonPath = path.join(import.meta.dirname, '../', 'backend', '.tmp', 'auth_info.json')
                    try {
                        const data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
                            nlConnectToken: string
                            nlPort: number
                            nlToken: string
                        }
                        const script = `<script src="http://localhost:${data.nlPort}/__neutralino_globals.js">window.NL_TOKEN = ${data.nlToken} window.NL_CONNECT_TOKEN = ${data.nlConnectToken}</script>`
                        return html.replace('<script>', `${script}\n<script>`)
                    } catch {
                        return html
                    }
                }
            }
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src')
            }
        },
        server: {
            proxy: {
                '/api': {
                    target: apiServer,
                    changeOrigin: true
                },
                '/socket.io': {
                    target: apiServer,
                    ws: true,
                    changeOrigin: true
                },
                '/test': {
                    target: apiServer,
                    changeOrigin: true
                },
                '/logo.png': {
                    target: apiServer,
                    changeOrigin: true
                }
            }
        }
    }
})
