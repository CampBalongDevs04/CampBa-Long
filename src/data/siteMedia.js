// ============================================================================
//  Site media — the video files staff upload from the dashboard
// ----------------------------------------------------------------------------
//  The twin of data/catalogImages.js, for the one kind of file that bucket
//  cannot take. `catalog-images` is sized for menu cards: 5 MB, image mime
//  types only. The home page's background clip is neither, so it goes to
//  `site-media` — see supabase/migrations/20260807120000_home_hero_cms.sql for
//  why raising the catalog bucket's ceiling instead would have been the wrong
//  trade.
//
//  Same shape as an image upload, and for the same reasons: the file goes to
//  the bucket when it is picked, the row keeps the URL it came back with, and
//  the size is checked here as well as in the bucket so a staff member on
//  resort wifi is told "that's 90 MB, the limit is 60" before they wait out
//  the upload.
// ============================================================================

import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

export const SITE_MEDIA_BUCKET = 'site-media'

// Must stay in step with the bucket's own limit, which is the real boundary.
const MAX_BYTES = 60 * 1024 * 1024
export const MAX_VIDEO_MB = 60

const FORMATS = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
}
const BY_EXTENSION = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
}

// A phone handing over a File with an empty `type` is common enough that a
// legitimate clip would otherwise be rejected for having no mime type.
function formatOf(file) {
    const mime = FORMATS[file.type] ? file.type : null
    if (mime) return { mime, extension: FORMATS[mime] }

    const extension = String(file.name ?? '').split('.').pop()?.toLowerCase()
    const guessed = BY_EXTENSION[extension]
    if (guessed) return { mime: guessed, extension: FORMATS[guessed] }

    return null
}

// crypto.randomUUID() exists only in a secure context, and a dev server reached
// over plain http on the LAN isn't one — same reason as uploadCatalogImage().
function randomKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function megabytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1)
}

// Put a picked clip in the bucket and hand back the URL the row should store.
export async function uploadSiteVideo(file, folder = 'hero') {
    if (!file) return { ok: false, message: 'Pick a video first.' }

    // Checked before the request rather than after it fails: without keys the
    // upload is aimed at a placeholder host and comes back "Failed to fetch",
    // which reads as a broken bucket.
    if (!isSupabaseConfigured) {
        return { ok: false, message: SUPABASE_SETUP_MESSAGE }
    }

    const format = formatOf(file)
    if (!format) {
        return {
            ok: false,
            message: 'That file is not a video the site can play. Use an MP4 or WebM.',
        }
    }

    if (file.size > MAX_BYTES) {
        return {
            ok: false,
            message: `That video is ${megabytes(file.size)} MB and the limit is ${MAX_VIDEO_MB} MB. `
                + 'Re-export it smaller (720p is plenty for a background clip) and try again.',
        }
    }

    const path = `${folder}/${randomKey()}.${format.extension}`

    const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).upload(path, file, {
        contentType: format.mime,
        upsert: false,
    })

    if (error) {
        console.error('Site video upload failed:', error.message)
        // The two failures staff can act on, named rather than left in
        // storage's own words.
        if (/bucket not found/i.test(error.message)) {
            return {
                ok: false,
                message: 'The video storage is not set up on this database yet. Apply the '
                    + 'home hero migration (supabase/migrations) and try again.',
            }
        }
        if (/row-level security|violates|unauthorized|jwt/i.test(error.message)) {
            return {
                ok: false,
                message: 'Only a signed-in staff account can upload videos. Sign in again and retry.',
            }
        }
        return { ok: false, message: `Could not upload that video: ${describeSupabaseError(error)}` }
    }

    const { data } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path)
    return { ok: true, url: data.publicUrl, path }
}
