import { ICON_COMPONENTS, ICON_ASSETS } from '../data/cmsIcons.js'

// Turns what a CMS row stores — an icon name, or the URL of one staff
// uploaded — into something on screen. The two kinds of bundled icon and the
// reason a row can only hold a name are explained in data/cmsIcons.js.
//
// The uploaded icon wins: staff who uploaded one have said what they want
// shown, and a bundled asset outranking it would look like the upload had been
// thrown away. A row naming nothing renders nothing — an empty circle is a
// better answer than a wrong icon.
export default function CmsIcon({ iconKey = '', iconUrl = null, alt = '' }) {
    if (iconUrl) return <img src={iconUrl} alt={alt} />

    const Component = ICON_COMPONENTS[iconKey]
    if (Component) return <Component />

    const asset = ICON_ASSETS[iconKey]
    if (asset) return <img src={asset} alt={alt} />

    return null
}
