import { Component } from 'react'
import './css/error-boundary.css'

// The last thing between a thrown render error and a blank white page.
//
// React unmounts the entire tree when a render throws and nothing catches it.
// Without a boundary the guest is left looking at <div id="root"></div> — a
// white screen, no message, no way forward, and nothing in the page to suggest
// reloading would help. The error is in the console, which no guest has open.
//
// THE FAILURE THIS ACTUALLY CATCHES MOST OFTEN
// --------------------------------------------
// Not a coding mistake — a deploy. Every page here is a lazy chunk
// (see App.jsx), and Vite fingerprints each one: booking-BZzwE04h.js becomes
// booking-<new hash>.js on the next build. A guest who opened the site before
// a deploy is holding an index.html that names the OLD filenames. When they
// then tap "Book Now!", the dynamic import fetches a file the host no longer
// has, the import rejects, and — because a rejected import is not a Suspense
// fallback but a thrown error — the whole app disappears mid-booking.
//
// That case is worth telling apart from a genuine bug: the site is not broken,
// the guest's copy is simply out of date, and one reload fixes it completely.
// Saying so is the difference between a guest reloading and a guest leaving.
//
// Deliberately NOT automatic. A reload triggered by the boundary would loop
// forever if the error turns out to be reproducible, and a page that reloads
// itself endlessly is worse than one that explains itself once.

const STALE_CHUNK_PATTERN =
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i

function isStaleChunkError(error) {
    return STALE_CHUNK_PATTERN.test(error?.message ?? '')
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error) {
        return { error }
    }

    componentDidCatch(error, info) {
        // Kept even though the fallback is now visible: the on-screen message
        // is written for a guest and says nothing a developer could debug
        // from. The component stack is the part that locates the fault.
        console.error(
            '[Camp Ba-long] A render error took down the page.',
            error,
            info?.componentStack,
        )
    }

    render() {
        const { error } = this.state
        if (!error) return this.props.children

        const stale = isStaleChunkError(error)

        return (
            <div className="error-boundary" role="alert">
                <div className="error-boundary-card">
                    <h1 className="error-boundary-title">
                        {stale ? 'This page needs a refresh' : 'Something went wrong'}
                    </h1>

                    <p className="error-boundary-body">
                        {stale
                            ? 'The site was updated while this tab was open, so part of it could not load. Reloading will pick up the new version — nothing you entered on this page has been sent yet.'
                            : 'We hit an unexpected error and could not finish loading this page. Reloading usually clears it. If it keeps happening, please message us on the chat bubble or call the resort and we will take your booking directly.'}
                    </p>

                    <div className="error-boundary-actions">
                        <button
                            type="button"
                            className="error-boundary-button"
                            onClick={() => window.location.reload()}
                        >
                            Reload the page
                        </button>
                        {/* A plain anchor, not a router Link: the router is
                            part of the tree that just failed, so a client-side
                            navigation could land straight back here. A real
                            document request re-fetches index.html and the
                            current chunk names with it, which is also exactly
                            what the stale-chunk case needs. */}
                        <a className="error-boundary-link" href="/">
                            Back to the home page
                        </a>
                    </div>

                    {/* The message only — never the stack. This renders on the
                        live site in front of guests. */}
                    <p className="error-boundary-detail">{String(error?.message ?? error)}</p>
                </div>
            </div>
        )
    }
}
