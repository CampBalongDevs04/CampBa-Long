// Date-range wording shared by the export calendar (calendar.jsx) and the
// export panel's filename/heading (export.jsx).
//
// It lives in its own module rather than beside the Calendar component because
// a file that exports both a component and a plain function opts out of Vite's
// fast refresh — editing the component would reload the whole page instead of
// swapping it in place.

// 'Jul 21, 2026 — Jul 24, 2026', or a prompt for whichever end is missing.
export function formatRangeLabel(start, end) {
    if (!start) return 'No dates selected'
    const opts = { month: 'short', day: 'numeric', year: 'numeric' }
    if (!end) return `${start.toLocaleDateString(undefined, opts)} — pick an end date`
    return `${start.toLocaleDateString(undefined, opts)} — ${end.toLocaleDateString(undefined, opts)}`
}
