// ============================================================================
//  The icons a CMS row can name
// ----------------------------------------------------------------------------
//  A row can only ever hold the NAME of an icon the site ships with, because
//  Vite decides the artwork's final form at build time: some of these are React
//  components drawing inline SVG, the rest are .svg files it hashes into the
//  bundle. Neither URL is knowable from SQL. So the database says 'pool' and
//  this module is where that becomes something real — the same arrangement the
//  food menu uses for its bundled photos.
//
//  WHY BOTH KINDS ARE IN ONE LIST
//  ------------------------------
//  They render differently and always have: an inline <svg> takes its colour
//  from the stylesheet (`.story-list-icon svg { stroke: var(--cream) }`), while
//  a file has to go through an <img> and is turned cream with a filter. Keeping
//  one list means staff pick from one menu, and neither the picker nor the page
//  has to care which kind they landed on — components/CmsIcon.jsx is the only
//  thing that does.
//
//  This is a data module rather than part of CmsIcon.jsx because the dashboard
//  needs the LIST without rendering anything, and a file that exports both a
//  component and its helpers breaks Vite's Fast Refresh.
// ============================================================================

import PoolIcon from '../components/PoolIcon.jsx'
import NatureIcon from '../components/NatureIcon.jsx'
import RelaxationIcon from '../components/RelaxationIcon.jsx'
import WellnessIcon from '../components/WellnessIcon.jsx'
import FoodIcon from '../components/FoodIcon.jsx'
import SpaIcon from '../components/SpaIcon.jsx'

import leafSvg from '../assets/svg/leaf.svg'
import familySvg from '../assets/svg/family.svg'
import cameraSvg from '../assets/svg/camera.svg'
import heartSvg from '../assets/svg/heart.svg'
import waterSvg from '../assets/svg/water.svg'
import bedSvg from '../assets/svg/bed.svg'
import diningSvg from '../assets/svg/dining.svg'
import timeSvg from '../assets/svg/time.svg'
import parkingSvg from '../assets/svg/parking.svg'
import transpoSvg from '../assets/svg/transpo.svg'

// Drawn inline, so they inherit their colour from whatever circle they sit in.
export const ICON_COMPONENTS = {
    pool: PoolIcon,
    nature: NatureIcon,
    relaxation: RelaxationIcon,
    wellness: WellnessIcon,
    food: FoodIcon,
    spa: SpaIcon,
}

// Loaded as files, so they go through an <img>.
export const ICON_ASSETS = {
    leaf: leafSvg,
    family: familySvg,
    camera: cameraSvg,
    heart: heartSvg,
    water: waterSvg,
    bed: bedSvg,
    dining: diningSvg,
    time: timeSvg,
    parking: parkingSvg,
    transpo: transpoSvg,
}

// What the dashboard's icon picker is built from, so the menu of icons and the
// icons that actually resolve cannot drift apart. The labels say what each one
// is FOR rather than what it depicts — staff are picking an icon for "Family
// Friendly", not shopping for a drawing of people.
export const CMS_ICON_OPTIONS = [
    { value: 'pool', label: 'Pool — water and swimming' },
    { value: 'nature', label: 'Leaf & hill — nature and the grounds' },
    { value: 'relaxation', label: 'Lotus — relaxation and calm' },
    { value: 'wellness', label: 'Wellness — spa and treatments' },
    { value: 'food', label: 'Cutlery — food and dining' },
    { value: 'spa', label: 'Massage — spa services' },
    { value: 'leaf', label: 'Leaf — escape and greenery' },
    { value: 'family', label: 'Family — groups and all ages' },
    { value: 'camera', label: 'Camera — scenery and photos' },
    { value: 'heart', label: 'Heart — wellness and care' },
    { value: 'water', label: 'Water — the spring and pools' },
    { value: 'bed', label: 'Bed — stays and rooms' },
    { value: 'dining', label: 'Dining — meals' },
    { value: 'time', label: 'Clock — opening hours' },
    { value: 'parking', label: 'Parking — free parking' },
    { value: 'transpo', label: 'Transport — getting here' },
]

// Whether a row resolves to anything at all. The dashboard uses it to say so
// on a tile whose icon is missing, rather than leaving staff to wonder why the
// circle on the page is empty.
export function hasCmsIcon(iconKey = '', iconUrl = null) {
    return Boolean(iconUrl || ICON_COMPONENTS[iconKey] || ICON_ASSETS[iconKey])
}
