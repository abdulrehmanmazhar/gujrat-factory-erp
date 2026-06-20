import fs from 'node:fs'

fs.cpSync('mails', 'dist/mails', { recursive: true })
fs.cpSync('templates', 'dist/templates', { recursive: true })
