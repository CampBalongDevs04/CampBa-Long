// Turn an admin URL into the two .env lines that unlock it.
//
//   node scripts/admin-path-hash.mjs some-path-only-staff-know
//
// Leave the leading slash off: Git Bash on Windows rewrites a bare "/foo"
// argument into "C:/Program Files/Git/foo" before node ever sees it.
//
// The app never ships the path itself, only the digest printed here, so
// rotating the URL is: run this, paste both lines into .env and into the
// hosting provider's environment, rebuild. See src/lib/adminRoute.js.
import { createHash } from 'node:crypto'

const raw = process.argv[2]

if (!raw) {
    console.error('Usage: node scripts/admin-path-hash.mjs your-admin-path')
    process.exit(1)
}

// Must match normalisePath() in src/lib/adminRoute.js, or the browser will
// hash something slightly different and the route will never match.
const path = ('/' + raw.trim().replace(/^\/+|\/+$/g, '')).toLowerCase()

if (path === '/') {
    console.error('Refusing to hash "/" — that would put the dashboard on the home page.')
    process.exit(1)
}

const hash = createHash('sha256').update(path, 'utf8').digest('hex')

console.log(`\nAdmin path : ${path}`)
console.log('\nAdd to .env (and to your host\'s environment variables):\n')
console.log(`VITE_ADMIN_PATH=${path}`)
console.log(`VITE_ADMIN_PATH_HASH=${hash}\n`)
console.log('VITE_ADMIN_PATH is used by `npm run dev` only — the production')
console.log('build strips it. VITE_ADMIN_PATH_HASH is what ships.\n')
