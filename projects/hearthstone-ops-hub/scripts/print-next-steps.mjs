#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const appRoot = path.join(projectRoot, 'app')
const envLocal = path.join(appRoot, '.env.local')
const generatedSeed = path.join(projectRoot, 'seed-import.generated.sql')

const checks = [
  {
    label: 'app/.env.local',
    exists: fs.existsSync(envLocal),
    next: '先复制 .env.example -> .env.local，并填写 Supabase anon key。',
  },
  {
    label: 'seed-import.generated.sql',
    exists: fs.existsSync(generatedSeed),
    next: '拿到 Supabase user_id 后运行 node scripts/generate-seed-sql.mjs <USER_ID>',
  },
]

console.log('Hearthstone Ops Hub · Next Steps')
console.log('')
for (const item of checks) {
  console.log(`${item.exists ? '✅' : '❌'} ${item.label}`)
  if (!item.exists) {
    console.log(`   -> ${item.next}`)
  }
}

console.log('')
console.log('推荐顺序：')
console.log('1. cd app && npm run check:env')
console.log('2. npm run dev')
console.log('3. 打开 /setup')
console.log('4. 打开 /auth 做 Magic Link 登录')
console.log('5. 回 /setup 跑健康检查')
console.log('6. 回 /tasks 测真实写回')
