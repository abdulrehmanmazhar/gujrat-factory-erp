import fs from 'node:fs'

const copies = [
    ['mails', 'dist/mails'],
    ['templates', 'dist/templates'],
    ['migrations', 'dist/migrations'],
    ['public', 'dist/public']
]

for (const [src, dest] of copies) {
    if (!fs.existsSync(src)) {
        console.warn(`[postbuild] skipped missing folder: ${src}`)
        continue
    }

    fs.cpSync(src, dest, { recursive: true })
    console.log(`[postbuild] copied ${src} -> ${dest}`)
}
