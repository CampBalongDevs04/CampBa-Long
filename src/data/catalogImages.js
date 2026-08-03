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
const FORMATS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
}
const BY_EXTENSION = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
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
