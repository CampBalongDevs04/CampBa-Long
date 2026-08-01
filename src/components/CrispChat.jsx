import { useEffect } from 'react'

// Crisp live chat.
//
// The website ID is a public embed identifier — it ships in the page source of
// every site that uses Crisp, and Crisp's own install snippet is a literal
// like this one. So it stays here rather than in email_settings or .env: there
// is nothing to protect, and hiding it would only make the widget one more
// thing that silently fails on a machine with a half-filled config.
const WEBSITE_ID = 'd4ed6da3-470d-46f1-b035-f66cd65e445a'
const SCRIPT_SRC = 'https://client.crisp.chat/l.js'

// Renders nothing. Crisp draws its own launcher into the body, outside React's
// tree, so this component exists only to own the script's lifetime.
//
// `reversed` moves the launcher to the bottom LEFT. It is not cosmetic: the
// menu and spa pages pin a 360px kiosk order tray to `right: 1.5rem; bottom:
// 1.5rem`, and Crisp's launcher sits in that same corner at a z-index far
// above it — so on those two pages the chat bubble would cover the tray's
// checkout control. Guests can chat from anywhere else; they can only order
// from there.
export default function CrispChat({ reversed = false }) {
    useEffect(() => {
        // The queue has to exist before l.js does. Anything pushed onto it
        // beforehand is replayed once the script finishes loading, which is
        // what makes the config push below safe to fire immediately.
        window.$crisp = window.$crisp || []
        window.CRISP_WEBSITE_ID = WEBSITE_ID

        // Guard on the tag rather than a module flag: this component unmounts
        // and remounts on every trip through the admin route, and loading
        // l.js twice gives Crisp two launchers.
        if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
            const script = document.createElement('script')
            script.src = SCRIPT_SRC
            script.async = true
            document.head.appendChild(script)
        }

        // Show on mount, hide on unmount — the script stays loaded either way.
        // Removing it would not take the launcher down with it (Crisp has
        // already drawn into the body by then), and re-adding it later would
        // cost the guest a second download of a script they still have.
        window.$crisp.push(['do', 'chat:show'])
        return () => {
            window.$crisp.push(['do', 'chat:hide'])
        }
    }, [])

    // Separate effect: the side can change on navigation without the script
    // needing to reload.
    useEffect(() => {
        window.$crisp = window.$crisp || []
        window.$crisp.push(['config', 'position:reverse', [reversed]])
    }, [reversed])

    return null
}
