import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VITE_ADMIN_PATH_HASH is in here because without it the dashboard has no
// route at all — the build would succeed and staff would find a dead URL.
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_ADMIN_PATH_HASH']

// Catch a missing .env in the terminal, before anyone opens the browser.
//
// .env is gitignored on purpose — the keys are not in the repo — so a fresh
// clone starts with none, and the app then half-works: pages render from
// built-in defaults and only the database-backed parts fail. Whoever cloned it
// has no reason to suspect their environment, so this says so up front.
//
// loadEnv() reads the .env files AND any matching variables already in the
// process environment, which is how a hosting provider supplies them, so a
// correctly configured deploy passes this check without a .env file.
function requireSupabaseEnv(mode, root) {
    const env = loadEnv(mode, root, 'VITE_')
    const missing = REQUIRED.filter((name) => !env[name])
    if (missing.length === 0) return

    const detail =
        `Missing: ${missing.join(', ')}\n` +
        `Fix: copy .env.example to .env and fill in every value.\n` +
        `The keys are not in the repo by design — ask a teammate for them, or\n` +
        `read them from the Supabase dashboard under Project Settings -> API.\n` +
        `When deploying, set the same variables in your hosting provider: Vite\n` +
        `inlines them at BUILD time, so setting them only at run time does nothing.`

    // A build without keys produces a bundle that is permanently broken — the
    // values are baked in, so it cannot be fixed by configuring the server
    // afterwards. Better to fail here than to ship it. `dev` only warns, so
    // the front-end can still be worked on offline.
    if (process.argv.includes('build')) {
        throw new Error(`\n[Camp Ba-long] Cannot build without Supabase credentials.\n${detail}\n`)
    }

    console.warn(
        `\n\x1b[33m[Camp Ba-long] Supabase is not configured.\x1b[0m\n` +
        `Bookings, availability and receipt uploads will fail until this is fixed.\n` +
        `${detail}\n`,
    )
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  requireSupabaseEnv(mode, process.cwd())

  return {
    plugins: [react(), tailwindcss()],
  }
})
