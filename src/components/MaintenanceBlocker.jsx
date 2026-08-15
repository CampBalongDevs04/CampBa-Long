import './css/maintenanceBlocker.css'
import Seo from './Seo.jsx'
import LotusDividerIcon from './LotusDividerIcon.jsx'
import logoCamp from '../assets/images/logocamp.png'
import { useSiteMaintenance } from '../data/siteMaintenance.js'

// What every guest page answers with while staff have the Website Blocker on
// (dashboard → Maintenance → Website Blocker). The dashboard route never
// reaches this, so the switch can always be turned back off.
export default function MaintenanceBlocker() {
    const { heading, message, facebookUrl } = useSiteMaintenance()

    return (
        <>
            <Seo
                noindex
                title={`${heading} | Camp Ba-long Nature Farm & Resort`}
                description="The Camp Ba-long website is briefly unavailable while we work on it."
            />
            <main className="page maintenance-page">
                <div className="maintenance-shell">
                    <img src={logoCamp} alt="Camp Ba-long" className="maintenance-logo" />
                    <p className="maintenance-eyebrow">Camp Ba-long Nature Farm &amp; Resort</p>
                    <h1 className="maintenance-title">{heading}</h1>
                    <LotusDividerIcon />
                    <p className="maintenance-text">{message}</p>

                    {facebookUrl && (
                        <a
                            className="maintenance-fb"
                            href={facebookUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.75 8.44-4.92 8.44-9.94z" />
                            </svg>
                            Message us on Facebook
                        </a>
                    )}
                </div>
            </main>
        </>
    )
}
