import { useState } from 'react'
import './css/localMaintenanceNotice.css'
import { useSiteMaintenance, MAINTENANCE_BYPASSED_LOCALLY } from '../data/siteMaintenance.js'

// Local copies of the site skip the Website Blocker (see siteMaintenance.js),
// which makes it easy to forget the live site is still down for guests. This
// says so on every page until the switch is turned back off, or until it is
// closed for this page load. Never renders on the deployed site.
export default function LocalMaintenanceNotice() {
    const { isOn } = useSiteMaintenance()
    const [closed, setClosed] = useState(false)
    if (!MAINTENANCE_BYPASSED_LOCALLY || !isOn || closed) return null

    return (
        <div
            className="local-mtn-notice"
            role="status"
            title="Guests only see the maintenance page. This local copy skips it — turn it off in the dashboard under Maintenance → Website Blocker."
        >
            <span className="local-mtn-notice-text">Live site is on maintenance</span>
            <button
                type="button"
                className="local-mtn-notice-close"
                onClick={() => setClosed(true)}
                aria-label="Hide this reminder"
            >
                &times;
            </button>
        </div>
    )
}
