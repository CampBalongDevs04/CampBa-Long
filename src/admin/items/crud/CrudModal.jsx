import { useEffect, useRef, useState } from 'react'
import '../../css/crud.css'

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
// `type` is 'text' | 'url' | 'number' | 'textarea' | 'select' | 'checkbox'.
//
// `fields` may also be a FUNCTION of the current values, for the forms whose
// shape depends on what has been picked so far — a coffee row needs a cup size
// and a price table to sit in, and a dish does not.

function Field({ field, value, onChange }) {
    const { name, label, type = 'text', help, placeholder, options = [], disabled, rows } = field
    const id = `crud-field-${name}`

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
    renderPreview = null,
}) {
    const [values, setValues] = useState(initial)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    // Deleting takes two clicks. There is no undo behind it — a removed dish
    // takes its price history off the menu for good — and the button sits in
    // the same footer as Save.
    const [confirmingDelete, setConfirmingDelete] = useState(false)
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

    useEffect(() => {
        firstFieldRef.current?.querySelector('input, select, textarea')?.focus()
    }, [])

    const handleChange = (name, value) => {
        setValues((current) => ({ ...current, [name]: value }))
        // Typing into the form means the staff member has moved on from the
        // delete they were half-way through.
        setConfirmingDelete(false)
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
                    {renderPreview?.(values)}

                    {rows.map((row, index) => {
                        const content = row.map((field) => (
                            <Field
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                onChange={handleChange}
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
                        <button type="submit" className="crud-btn is-primary" disabled={busy}>
                            {busy ? 'Saving…' : submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
