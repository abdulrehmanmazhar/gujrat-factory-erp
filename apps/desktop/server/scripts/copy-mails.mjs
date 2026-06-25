import fs from 'node:fs'

const copies = [
    ['templates', 'dist/templates'],
    ['migrations', 'dist/migrations'],
    ['public', 'dist/public'],
    ['rclone', 'dist/rclone']
]

for (const [src, dest] of copies) {
    if (!fs.existsSync(src)) {
        console.warn(`[postbuild] skipped missing folder: ${src}`)
        continue
    }

    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true })
    }
    fs.cpSync(src, dest, { recursive: true })
    console.log(`[postbuild] copied ${src} -> ${dest}`)
}
