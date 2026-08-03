import { useEffect, useRef, useState } from 'react'
import '../../css/crud.css'
import { uploadCatalogImage } from '../../../data/catalogImages.js'

// The one form the dashboard's catalog editing opens in — food, spa and
// accommodation all use it, so a save behaves the same in every section:
// nothing closes until the database has accepted it, and a refusal is shown
// against the form the staff member is still looking at rather than as a
// browser alert they can dismiss without reading.
//
// Fields are described rather than written out, because the three catalogs
// differ only in which columns they have. An entry that is an ARRAY is one row
// of side-by-side fields (price + sort order), which is the only layout choice
// any of these forms needs.
//
//   { name, label, type, options, help, placeholder, disabled, rows }
//
// `type` is 'text' | 'url' | 'number' | 'textarea' | 'select' | 'checkbox'
// | 'image'.
//
// `fields` may also be a FUNCTION of the current values, for the forms whose
// shape depends on what has been picked so far — a coffee row needs a cup size
// and a price table to sit in, and a dish does not.

// The photo control every catalog form uses. Staff pick a file, it goes to the
// bucket immediately, and the field's value becomes the URL that gets saved on
// the row — so what the form shows after picking is the actual stored photo,
// not a local preview that might never make it.
//
// Two extra keys on the field describe the older ways a row could carry a
// photo, which uploading has to win over:
//
//   preview — what the guest is shown for this row RIGHT NOW, including the
//             bundled asset a dish that shipped with the site still uses. It is
//             what fills the frame before anything has been uploaded.
//   clears  — fields blanked when an upload lands, so a row that named a
//             bundled asset stops preferring it (see resolveMenuImage).
//
// The upload happening on pick rather than on save is deliberate: a save that
// had to upload first would leave the form sitting on "Saving…" for as long as
// the photo takes, and a failed upload would read as a failed save.
function ImageField({ field, value, onChange, onUploading }) {
    const { name, label, help, preview = null, folder = 'catalog', clears = [], disabled } = field
    const inputRef = useRef(null)
    const [busy, setBusy] = useState(false)
    const [problem, setProblem] = useState('')

    // `preview` is the resolved truth for the current values, so it leads; the
    // raw value is the fallback for a form that doesn't compute one.
    const shown = preview || value || null
    // Only an uploaded photo can be taken off. A bundled one belongs to the
    // build — "Remove" on it would clear a field that was never set.
    const canRemove = Boolean(value)

    const handlePick = async (e) => {
        const file = e.target.files?.[0]
        // Cleared so picking the SAME file again still fires a change, which is
        // exactly what a staff member does after a failed upload.
        e.target.value = ''
        if (!file) return

        setBusy(true)
        setProblem('')
        onUploading(name, true)

        const result = await uploadCatalogImage(file, folder)

        setBusy(false)
        onUploading(name, false)

        if (!result.ok) {
            setProblem(result.message)
            return
        }

        onChange(name, result.url)
        for (const other of clears) onChange(other, '')
    }

    return (
        <div className="crud-field crud-image-field">
            <label htmlFor={`crud-field-${name}`}>{label}</label>
            <div className="crud-image-control">
                <div className="crud-image-preview is-large">
                    {shown ? (
                        <img src={shown} alt="" />
                    ) : (
                        <span className="crud-image-none">No photo</span>
                    )}
                </div>
                <div className="crud-image-actions">
                    <input
                        id={`crud-field-${name}`}
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="crud-image-input"
                        disabled={disabled || busy}
                        onChange={handlePick}
                    />
                    <div className="crud-image-buttons">
                        <button
                            type="button"
                            className="crud-btn is-small is-primary"
                            disabled={disabled || busy}
                            onClick={() => inputRef.current?.click()}
                        >
                            {busy ? 'Uploading…' : shown ? 'Replace image' : 'Upload image'}
                        </button>
                        {canRemove && (
                            <button
                                type="button"
                                className="crud-btn is-small is-danger"
                                disabled={disabled || busy}
                                onClick={() => onChange(name, '')}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                    <p className="crud-field-help">
                        {shown && !canRemove
                            ? 'This one shipped with the site. Uploading replaces it.'
                            : help || 'JPG, PNG or WebP, up to 5 MB.'}
                    </p>
                </div>
            </div>
            {problem && <p className="crud-message is-error">{problem}</p>}
        </div>
    )
}

function Field({ field, value, onChange, onUploading }) {
    const { name, label, type = 'text', help, placeholder, options = [], disabled, rows } = field
    const id = `crud-field-${name}`

    if (type === 'image') {
        return (
            <ImageField field={field} value={value} onChange={onChange} onUploading={onUploading} />
        )
    }

    if (type === 'checkbox') {
        return (
            <div className="crud-field crud-field-check">
                <input
                    id={id}
                    type="checkbox"
                    checked={Boolean(value)}
                    disabled={disabled}
                    onChange={(e) => onChange(name, e.target.checked)}
                />
                <label htmlFor={id}>{label}</label>
            </div>
        )
    }

    return (
        <div className="crud-field">
            <label htmlFor={id}>{label}</label>
            {type === 'textarea' ? (
                <textarea
                    id={id}
                    value={value ?? ''}
                    rows={rows ?? 3}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={(e) => onChange(name, e.target.value)}
                />
            ) : type === 'select' ? (
                <select
                    id={id}
                    value={value ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange(name, e.target.value)}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    id={id}
                    type={type}
                    value={value ?? ''}
                    placeholder={placeholder}
                    disabled={disabled}
                    // Free text, not a spinner-stepped number: prices here are
                    // whole pesos and staff type them.
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    onChange={(e) => onChange(name, e.target.value)}
                />
            )}
            {help && <p className="crud-field-help">{help}</p>}
        </div>
    )
}

export default function CrudModal({
    title,
    subtitle,
    fields,
    initial = {},
    submitLabel = 'Save',
    onSubmit,
    onClose,
    onDelete = null,
    deleteLabel = 'Delete',
}) {
    const [values, setValues] = useState(initial)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    // Deleting takes two clicks. There is no undo behind it — a removed dish
    // takes its price history off the menu for good — and the button sits in
    // the same footer as Save.
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    // Which photo fields are mid-upload. Saving is held until they land: the
    // field's value only becomes the stored URL once the file is in the bucket,
    // so a save that beat the upload would write the OLD photo and look like
    // the picked one had simply been ignored.
    const [uploading, setUploading] = useState(() => new Set())
    const firstFieldRef = useRef(null)

    // Escape closes, which is what every other modal in the dashboard does.
    // Ignored mid-save: the write is already on its way and the form is the
    // only place its answer can be shown.
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !busy) onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, busy])

    // The file input of a photo field is skipped: focusing it opens nothing and
    // leaves the form looking like it has no focus at all.
    useEffect(() => {
        firstFieldRef.current
            ?.querySelector('input:not([type="file"]), select, textarea')
            ?.focus()
    }, [])

    const handleChange = (name, value) => {
        setValues((current) => ({ ...current, [name]: value }))
        // Typing into the form means the staff member has moved on from the
        // delete they were half-way through.
        setConfirmingDelete(false)
    }

    const handleUploading = (name, active) => {
        setUploading((current) => {
            const next = new Set(current)
            if (active) next.add(name)
            else next.delete(name)
            return next
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setError('')

        const result = await onSubmit(values)

        // Only a save the database accepted closes the form. A refused one
        // keeps every field as typed, so a corrected retry is one edit away.
        if (result?.ok) {
            onClose()
            return
        }
        setBusy(false)
        setError(result?.message || 'Could not save that. Try again.')
    }

    const handleDelete = async () => {
        if (busy || !onDelete) return
        if (!confirmingDelete) {
            setConfirmingDelete(true)
            return
        }
        setBusy(true)
        setError('')
        const result = await onDelete()
        if (result?.ok) {
            onClose()
            return
        }
        setBusy(false)
        setError(result?.message || 'Could not delete that.')
    }

    const resolvedFields = typeof fields === 'function' ? fields(values) : fields
    const rows = resolvedFields.map((entry) => (Array.isArray(entry) ? entry : [entry]))
    const isUploading = uploading.size > 0

    return (
        <div
            className="crud-overlay"
            role="presentation"
            // Only a click that both starts and ends on the backdrop closes —
            // dragging to select text inside the form must not throw it away.
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose()
            }}
        >
            <div className="crud-modal" role="dialog" aria-modal="true" aria-label={title}>
                <h3 className="crud-modal-title">{title}</h3>
                {subtitle && <p className="crud-modal-subtitle">{subtitle}</p>}

                {error && <p className="crud-message is-error">{error}</p>}

                <form className="crud-form" onSubmit={handleSubmit}>
                    {rows.map((row, index) => {
                        const content = row.map((field) => (
                            <Field
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                onChange={handleChange}
                                onUploading={handleUploading}
                            />
                        ))
                        const key = row.map((field) => field.name).join('-')
                        const ref = index === 0 ? firstFieldRef : undefined
                        return row.length === 1 ? (
                            <div key={key} ref={ref}>{content}</div>
                        ) : (
                            <div key={key} className="crud-form-row" ref={ref}>{content}</div>
                        )
                    })}

                    <div className="crud-modal-actions">
                        {onDelete && (
                            <button
                                type="button"
                                className="crud-btn is-danger is-delete"
                                disabled={busy}
                                onClick={handleDelete}
                            >
                                {confirmingDelete ? 'Tap again to confirm' : deleteLabel}
                            </button>
                        )}
                        <button type="button" className="crud-btn" disabled={busy} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="crud-btn is-primary"
                            disabled={busy || isUploading}
                        >
                            {busy ? 'Saving…' : isUploading ? 'Uploading photo…' : submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
