// The line drawing beside one assurance under the /booking title.
//
// Its own component rather than one of the shared CMS icons (components/
// CmsIcon.jsx) because these three are drawn for this one row: 24-unit strokes
// that take their colour from the text beside them, where the shared set is
// drawn to sit inside the circular badges used elsewhere on the site. The list
// a row can name is short and closed for the same reason.
//
// It is here rather than inside booking.jsx so the dashboard's preview draws
// the SAME artwork the page does — a preview with its own copy of the icons is
// a preview that can quietly stop matching.
const TRUST_ICONS = {
    lock: (
        <>
            <rect x="4" y="10" width="16" height="10" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
        </>
    ),
}

// A row naming an icon that does not exist draws nothing — an assurance with a
// blank space beside it still reads, where a wrong icon does not.
export default function BookingTrustIcon({ icon = '' }) {
    const art = TRUST_ICONS[icon]
    if (!art) return null

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {art}
        </svg>
    )
}
