import { useEffect } from 'react'
import '../css/exportPanel.css'
import Export from './export.jsx'

export default function ExportPanel({ open = false, onClose, bookings = [] }) {
    useEffect(() => {
        if (!open) return
        const handleKey = (e) => {
            if (e.key === 'Escape' && onClose) onClose()
        }
        window.addEventListener('keydown', handleKey)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', handleKey)
            document.body.style.overflow = ''
        }
    }, [open, onClose])

    return (
        <div className={open ? 'export-panel-root open' : 'export-panel-root'} aria-hidden={!open}>
            <div className="export-panel-backdrop" onClick={onClose} />
            <aside
                className="export-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Export reports"
            >
                <div className="export-panel-header">
                    <div className="export-panel-heading">
                        <p className="export-panel-eyebrow">Camp Ba-long</p>
                        <h2 className="export-panel-title">Export Reports</h2>
                    </div>
                    <button
                        type="button"
                        className="export-panel-close"
                        aria-label="Close export panel"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <div className="export-panel-body">
                    <Export bookings={bookings} />
                </div>
            </aside>
        </div>
    )
}
