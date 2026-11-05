// Lists interface text written as tr('…') that has no Uzbek or Russian translation yet.
// Run: npm run i18n:check
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !path.includes(join('src', 'i18n'))) files.push(path)
  }
}
walk('src')

const used = new Set()
const literal = /\btr\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
for (const file of files) {
  for (const m of readFileSync(file, 'utf8').matchAll(literal)) {
    const raw = m[1]
    used.add(raw.startsWith('"') ? JSON.parse(raw) : JSON.parse('"' + raw.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'))
  }
}

let missing = 0
for (const lang of ['uz', 'ru']) {
  const catalog = readFileSync(join('src', 'i18n', `${lang}.ts`), 'utf8')
  const keys = new Set([...catalog.matchAll(/^ {2}("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])))
  const gaps = [...used].filter((k) => !keys.has(k)).sort()
  missing += gaps.length
  console.log(`${lang}: ${gaps.length} missing`)
  for (const k of gaps) console.log(`  ${JSON.stringify(k)}`)
}
process.exitCode = missing ? 1 : 0
