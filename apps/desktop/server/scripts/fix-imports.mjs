import fs from 'node:fs'
import path from 'node:path'

function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'scripts') continue
        const p = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(p)
        else if (ent.name.endsWith('.ts')) fixFile(p)
    }
}

function addJs(m) {
    if (m.endsWith('.js') || m.endsWith('.json') || m.endsWith('.node')) return m
    return `${m}.js`
}

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8')
    const orig = content
    content = content.replace(/(?<=from\s['"])(\.\.?\/[^'"]+)(?=['"])/g, addJs)
    content = content.replace(/(?<=export\s+\*\s+from\s['"])(\.\.?\/[^'"]+)(?=['"])/g, addJs)
    content = content.replace(/(?<=import\s*\(\s*['"])(\.\.?\/[^'"]+)(?=['"])/g, addJs)
    if (content !== orig) fs.writeFileSync(filePath, content)
}

walk('.')
console.log('done')
