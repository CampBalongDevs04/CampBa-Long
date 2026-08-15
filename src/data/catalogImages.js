// ============================================================================
//  Catalog photos — uploaded from the dashboard, stored with the resort's data
// ----------------------------------------------------------------------------
//  One upload path for all three catalogs (food, spa, accommodation), because
//  a photo means the same thing in each: staff pick a file, it goes into the
//  public `catalog-images` bucket, and the row keeps the URL it came back with.
//  See supabase/migrations/20260803180000_catalog_image_uploads.sql.
//
//  WHY A URL ON THE ROW AND NOT THE IMAGE ITSELF
//  ---------------------------------------------
//  Postgres could hold the bytes, but then every menu card would arrive through
//  a database query instead of the CDN, and the catalog rows — which the guest
//  pages re-read on every realtime change — would carry megabytes each. The
//  bucket is storage; the row points at it. From the dashboard's side it is
//  still "the photo is in the database", because the URL is on the row and the
//  file is in the same project.
//
//  WHY THE UPLOAD IS CHECKED HERE AS WELL AS IN THE BUCKET
//  -------------------------------------------------------
//  The bucket rejects an oversized or wrong-typed file too, but it does so
//  after the whole thing has been sent and it answers in storage's own words.
//  A staff member on resort wifi should be told "that's 9 MB, the limit is 5"
//  before they wait out the upload.
// ============================================================================

import {
    supabase,
    isSupabaseConfigured,
    describeSupabaseError,
    SUPABASE_SETUP_MESSAGE,
} from '../lib/supabaseClient.js'

export const CATALOG_IMAGE_BUCKET = 'catalog-images'

// Must stay in step with the bucket's own limits, which are the real boundary.
const MAX_BYTES = 5 * 1024 * 1024
// SVG is here for the CMS icons, which are line art rather than photographs —
// see the tail of the welcome section migration for why widening the bucket to
// take it is safe. Everything else on this list is a photo format.
const FORMATS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
}
const BY_EXTENSION = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    svg: 'image/svg+xml',
}

// Some Android WebViews hand over a File with an empty `type`, so a legitimate
// photo would be rejected for having no mime type. Fall back to the filename.
function formatOf(file) {
    const mime = FORMATS[file.type] ? file.type : null
    if (mime) return { mime, extension: FORMATS[mime] }

    const extension = String(file.name ?? '').split('.').pop()?.toLowerCase()
    const guessed = BY_EXTENSION[extension]
    if (guessed) return { mime: guessed, extension: FORMATS[guessed] }

    return null
}

// crypto.randomUUID() exists only in a secure context, and a dev server reached
// over plain http on the LAN isn't one — same reason as uploadReceipt().
function randomKey() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function megabytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1)
}

// Put a picked file in the bucket and hand back the URL the row should store.
//
// `folder` only sorts the bucket for whoever browses it in the Supabase studio
// ('food', 'spa', 'accommodations'); the filename is random, so two photos can
// never collide and no name has to be sanitised.
export async function uploadCatalogImage(file, folder = 'catalog') {
    if (!file) return { ok: false, message: 'Pick an image first.' }

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
            message: 'That file is not an image the site can show. Use a JPG, PNG, WebP, AVIF or GIF.',
        }
    }

    if (file.size > MAX_BYTES) {
        return {
            ok: false,
            message: `That image is ${megabytes(file.size)} MB and the limit is 5 MB. `
                + 'Resize or re-export it, then try again.',
        }
    }

    const path = `${folder}/${randomKey()}.${format.extension}`

    const { error } = await supabase.storage.from(CATALOG_IMAGE_BUCKET).upload(path, file, {
        contentType: format.mime,
        upsert: false,
    })

    if (error) {
        console.error('Catalog image upload failed:', error.message)
        // The two failures staff can actually act on, named rather than left as
        // storage's wording: the migration has not been applied to this
        // project, or they are editing without a staff session.
        if (/bucket not found/i.test(error.message)) {
            return {
                ok: false,
                message: 'The photo storage is not set up on this database yet. Apply the '
                    + 'catalog image migration (supabase/migrations) and try again.',
            }
        }
        if (/row-level security|violates|unauthorized|jwt/i.test(error.message)) {
            return {
                ok: false,
                message: 'Only a signed-in staff account can upload photos. Sign in again and retry.',
            }
        }
        return { ok: false, message: `Could not upload that photo: ${describeSupabaseError(error)}` }
    }

    const { data } = supabase.storage.from(CATALOG_IMAGE_BUCKET).getPublicUrl(path)
    return { ok: true, url: data.publicUrl, path }
}


// ================================ moving a bundled photo into the bucket

// The longest edge a re-encoded photo keeps by default. A ceiling, not a
// target: a photo already smaller than this keeps its own size.
const DEFAULT_MAX_EDGE = 1600
// Comfortably under MAX_BYTES so a re-encode that lands slightly larger than
// predicted still fits.
const REENCODE_MAX_BYTES = 4 * 1024 * 1024

// Shrink and re-encode an image so the bucket will take it.
//
// This exists because the photos bundled with the front end are print-sized.
// The spa gallery's six come to 26 MB between them and one is 12.1 MB — more
// than twice the bucket's limit — so copying a shipped photo into storage
// cannot be a straight copy; the upload is refused outright.
//
// Re-encoding is less a workaround for that limit than the thing that should
// have happened to these files already: they are full-size PNGs displayed a
// few hundred pixels wide, so every visitor downloads megabytes to look at
// something small. A WebP capped at `maxEdge` is visually identical in place
// and a fraction of the weight.
export async function shrinkImageForUpload(blob, name, maxEdge = DEFAULT_MAX_EDGE) {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    // Quality is stepped down rather than fixed, so an unusually detailed photo
    // still lands under the limit instead of failing at the bucket.
    for (const quality of [0.85, 0.7, 0.55]) {
        const encoded = await new Promise((resolve) =>
            canvas.toBlob(resolve, 'image/webp', quality),
        )
        // A browser without WebP encoding answers null; JPEG is the floor every
        // canvas can write, and the bucket takes it.
        if (!encoded) break
        if (encoded.size <= REENCODE_MAX_BYTES) {
            return new File([encoded], `${name}.webp`, { type: 'image/webp' })
        }
    }

    const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75))
    if (!jpeg) throw new Error('This browser could not re-encode the photo.')
    return new File([jpeg], `${name}.jpg`, { type: 'image/jpeg' })
}

// Copy one photo that shipped inside the build into the resort's own storage.
//
// WHY THIS IS NEEDED AT ALL
// -------------------------
// A photo bundled with the front end looks like content but is not: there is
// no URL a database row could hold, because Vite hashes the filename at build
// time. So the dashboard has nothing to list and nothing to replace — staff
// see an upload button and no photo, and the only way to change one is to find
// the original file and upload it by hand. This is that hand work, done once
// and by the machine.
//
// `source` is whatever Vite resolved the import to, which is a path on this
// site in both dev and a built bundle, so the fetch is same-origin.
export async function uploadBundledImage(source, { name, folder = 'catalog', maxEdge } = {}) {
    if (!isSupabaseConfigured) return { ok: false, message: SUPABASE_SETUP_MESSAGE }

    let file
    try {
        const response = await fetch(source)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        file = await shrinkImageForUpload(await response.blob(), name, maxEdge)
    } catch (problem) {
        console.error('Could not prepare a bundled photo:', problem)
        return { ok: false, message: 'Could not read that photo from the site. Try again.' }
    }

    return uploadCatalogImage(file, folder)
}
