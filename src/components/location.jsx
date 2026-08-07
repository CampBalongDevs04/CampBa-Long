import { useState } from 'react'
import './css/location.css'
import LotusDividerIcon from './LotusDividerIcon'
import CmsIcon from './CmsIcon.jsx'
import { Skeleton } from './skeletons/Skeleton.jsx'
import { useLocationSection } from '../data/locationSection.js'

// The heading, the contact card and the tiles under the map come from three
// tables, written in the dashboard's CMS → Location — see
// data/locationSection.js. Until they land (and on a database that predates
// them) the store answers with the copy the site shipped with, so this block is
// never blank and never half-built.
//
// THE MAP IS NOT CMS CONTENT
// --------------------------
// The embed below stays written here on purpose. It is not copy: it is a URL
// carrying a place query, a latitude, a longitude and a zoom level, and one
// wrong character in any of them fails silently — the frame shows the wrong
// village, or nothing at all, and reads as a broken site rather than as a field
// somebody needs to correct. The resort has not moved. The "Get Directions"
// button beside it IS editable, because a label and a link are exactly the kind
// of thing that changes.

export default function Location(){
    const [mapLoaded, setMapLoaded] = useState(false)
    const { section, activeDetails, activeFeatures } = useLocationSection()

    return(
        <>
            <section className = "location-section">

                <div className = "location-header">
                    <LotusDividerIcon />
                    {section.eyebrow && <p className = "location-eyebrow">{section.eyebrow}</p>}
                    {section.title && <h1 className = "location-title">{section.title}</h1>}
                    {section.subtitle && <p className = "location-sub">{section.subtitle}</p>}
                </div>

                <div className = "location-body">

                    <div className = "location-card">
                        {activeDetails.map((detail) => (
                            <div className = "location-detail" key = {detail.id}>
                                <span className = "location-detail-icon">
                                    <CmsIcon iconKey = {detail.iconKey} iconUrl = {detail.iconUrl} alt = "" />
                                </span>
                                <div className = "location-detail-text">
                                    <h3 className = "location-detail-label">{detail.label}</h3>
                                    {detail.lines.map((line, i) => (
                                        <p className = "location-information" key = {i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {/* No label means no button, the same rule the hero's
                            two buttons follow — a blank one would just sit
                            there. */}
                        {section.directionsLabel && (
                            <a
                                className = "location-directions-btn"
                                href = {section.directionsHref || '#'}
                                target = "_blank"
                                rel = "noopener noreferrer"
                            >
                                {section.directionsLabel}
                            </a>
                        )}
                    </div>

                    <div className = "location-map">
                        <iframe
                            title = "Camp Ba-long Nature Farm map"
                            src = "https://maps.google.com/maps?q=Camp+Ba-long+Nature+Farm,+Liliw,+Laguna&ll=14.1263549,121.4312552&z=16&output=embed"
                            loading = "lazy"
                            allowFullScreen
                            referrerPolicy = "no-referrer-when-downgrade"
                            onLoad = {() => setMapLoaded(true)}
                        ></iframe>
                        {!mapLoaded && <Skeleton photo className="skel-img-cover" />}
                    </div>

                </div>

                {/* Gone entirely rather than left as an empty strip, for the
                    same reason the hero's feature row is: staff who hid every
                    tile hid the strip. */}
                {activeFeatures.length > 0 && (
                    <div className = "location-features">
                        {activeFeatures.map((feature) => (
                            <div className = "location-feature" key = {feature.id}>
                                <span className = "location-feature-icon">
                                    <CmsIcon iconKey = {feature.iconKey} iconUrl = {feature.iconUrl} alt = "" />
                                </span>
                                <h3 className = "location-feature-title">{feature.title}</h3>
                                {feature.description && (
                                    <p className = "location-feature-text">{feature.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </section>
        </>
    )
}
