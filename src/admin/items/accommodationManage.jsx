import { useEffect, useState } from 'react'
import '../css/accommodationManage.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    STAY_SCHEDULES,
    useAdminAccommodations,
    loadAdminAccommodations,
    saveAccommodationType,
    deleteAccommodationType,
    saveAccommodationRate,
    deleteAccommodationRate,
} from '../../data/accommodationDB.js'
import { resolveAccommodationImage } from '../../data/accomodationOptions.js'
import {
    usePromoMarquee,
    loadPromoMarquee,
    savePromoMarquee,
} from '../../data/promoMarquee.js'

// Units → Manage Accommodations. What the resort sells, and what it costs.
//
// TWO THINGS ARE BEING EDITED, NOT ONE
// ------------------------------------
// An accommodation (the Teepee, and that there are two of them) and a RATE
// (what one Teepee costs under one stay schedule) are separate rows, because
// the same Teepee is ₱900 for Day Time and ₱1,700 overnight. So each card here
// has its own Edit, and a price line under it for each schedule group with its
// own. Removing a rate is how a unit stops being offered under that schedule —
// which is exactly why the Cottage is day-only and the tents overnight-only.
//
// Everything saved here reaches the booking page immediately: it builds its
// cards from these same rows (see data/accomodationOptions.js), so there is no
// second list to keep in step.

// The rate groups the stay schedules actually use, with the schedules that fall
// under each. Read from STAY_SCHEDULES rather than listed, so adding a fourth
// schedule later needs no change here.
const RATE_GROUPS = [...new Set(STAY_SCHEDULES.map((schedule) => schedule.rateGroup))].map(
    (group) => ({
        id: group,
        label: group === 'day' ? 'Day Time' : group === 'overnight' ? 'Overnight' : group,
        schedules: STAY_SCHEDULES.filter((schedule) => schedule.rateGroup === group)
            .map((schedule) => schedule.time)
            .join(' · '),
    }),
)

function formatPeso(amount) {
    return `₱${Number(amount ?? 0).toLocaleString('en-PH')}`
}

function typeFields(values) {
    const isNew = !values.id

    return [
        { name: 'name', label: 'Name', placeholder: 'A-House Small' },
        [
            {
                name: 'total',
                label: 'How many exist',
                type: 'number',
                help: 'The ceiling on overlapping bookings. Units are created to match.',
            },
            { name: 'sortOrder', label: 'Position', type: 'number', help: 'Lower shows first.' },
        ],
        {
            name: 'prefix',
            label: 'Unit prefix',
            placeholder: 'AHS',
            disabled: !isNew,
            help: isNew
                ? 'Unit ids are built from it: AHS → AHS-01, AHS-02.'
                : 'Fixed once units exist — bookings point at ids built from it.',
        },
        // The units that shipped with the site have a bundled photo, which is
        // what fills the frame until staff upload their own. An upload wins
        // over it everywhere the unit is shown — see resolveAccommodationImage.
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'accommodations',
            preview: resolveAccommodationImage(values.id, values.imageUrl),
            help: 'Shown on the booking page and the home page card. JPG, PNG or WebP, up to 5 MB.',
        },
        // The rest of the carousel. This is where the inside of the unit goes —
        // the bedding, the deck, the view — which the card's single photo has
        // never had room for.
        {
            name: 'gallery',
            label: 'Gallery',
            type: 'gallery',
            folder: 'accommodations',
            help: 'Extra photos for the “view more” window — the inside of the unit, the '
                + 'view, the setup. The main photo above is always the first slide; these '
                + 'follow in this order.',
        },
        // The home page card is built from these two. Without them a new
        // accommodation still gets a card — it just has nothing to say on it.
        {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            rows: 4,
            placeholder: 'A roofed open-air pavilion made for big celebrations…',
            help: 'Shown in the home page “view more” window.',
        },
        {
            name: 'features',
            label: "What's included",
            type: 'textarea',
            rows: 5,
            placeholder: 'Long table seating\nRoofed shelter\nCeiling fans',
            help: 'One per line. These are the ticks listed on the card.',
        },
        { name: 'isActive', label: 'Offer this on the booking page', type: 'checkbox' },
    ]
}

// The promo is a SECOND price beside the standing one, not a replacement for
// it. Staff used to run a promo by typing the discounted figure over the price
// and typing the old one back afterwards — which meant the original was gone
// while the promo ran (nothing to strike through on the card) and the way back
// depended on remembering it. Here the price field stays the standing rate all
// year, the promo sits under it, and the checkbox is the whole of starting and
// ending one. Raising the standing rate later is then just an edit of the price
// field, promo running or not.
function rateFields(values) {
    return [
        [
            {
                name: 'price',
                label: 'Original price (PHP)',
                type: 'number',
                placeholder: '1450',
                help: 'The standing rate. Leave it alone during a promo — this is what the '
                    + 'price goes back to when the promo ends.',
            },
            {
                name: 'paxLabel',
                label: 'Capacity shown',
                placeholder: '4-5 Pax',
                help: 'Written as it should read on the card.',
            },
        ],
        [
            {
                name: 'minPax',
                label: 'Smallest group',
                type: 'number',
                help: 'A smaller group can still book — it pays for the whole unit.',
            },
            {
                name: 'maxPax',
                label: 'Largest group',
                type: 'number',
                help: 'A bigger group cannot book. Leave both blank for no limit.',
            },
        ],
        {
            name: 'promoActive',
            label: 'Run a promo on this rate',
            type: 'checkbox',
        },
        {
            name: 'promoPrice',
            label: "Today's promo price (PHP)",
            type: 'number',
            placeholder: '1200',
            // Left editable while the promo is off so next month's promo can be
            // set up before it goes live — the checkbox is what guests see.
            help: values.promoActive
                ? 'Guests are charged this. The original price above is shown struck through beside it.'
                : 'Kept for next time. Nothing changes for guests until the box above is ticked.',
        },
    ]
}

// The scrolling banner above the accommodations on the home page. Its copy is
// written here rather than derived from the promos on the rates: a promo is a
// message before it is arithmetic ("book 2 nights, get a free tent"), and the
// wording is the part the resort wants to choose.
function bannerFields() {
    return [
        {
            name: 'messages',
            label: 'What it says',
            type: 'textarea',
            rows: 5,
            placeholder: 'Summer sale — 20% off all A-Houses\nBook 2 nights, get a free tent pitch',
            help: 'One line per item. They scroll past in this order, over and over.',
        },
        {
            name: 'isActive',
            label: 'Show the banner on the home page',
            type: 'checkbox',
        },
    ]
}

const BLANK_TYPE = {
    id: null,
    name: '',
    prefix: '',
    total: 1,
    imageUrl: '',
    gallery: [],
    description: '',
    features: '',
    sortOrder: 0,
    isActive: true,
}

function typeToDraft(type) {
    return {
        id: type.id,
        name: type.name,
        prefix: type.prefix,
        total: String(type.total),
        imageUrl: type.imageUrl ?? '',
        gallery: type.gallery ?? [],
        description: type.description ?? '',
        // Stored as an array, edited as lines.
        features: (type.features ?? []).join('\n'),
        sortOrder: type.sortOrder ?? 0,
        isActive: type.isActive,
    }
}

function rateToDraft(typeId, rateGroup, rate) {
    return {
        typeId,
        rateGroup,
        price: rate ? String(rate.price) : '',
        promoPrice: rate?.promoPrice != null ? String(rate.promoPrice) : '',
        promoActive: rate?.promoActive === true,
        paxLabel: rate?.paxLabel ?? '',
        minPax: rate?.minPax ?? '',
        maxPax: rate?.maxPax ?? '',
    }
}

export default function AccommodationManage() {
    const catalog = useAdminAccommodations()
    const banner = usePromoMarquee()
    const [editingType, setEditingType] = useState(null)
    const [editingRate, setEditingRate] = useState(null)
    const [editingBanner, setEditingBanner] = useState(null)

    useEffect(() => {
        loadAdminAccommodations()
        loadPromoMarquee()
    }, [])

    const rateFor = (typeId, rateGroup) =>
        catalog.rates.find((rate) => rate.typeId === typeId && rate.rateGroup === rateGroup) ?? null

    return (
        <div className="acc-manage-panel">
            <div className="crud-bar">
                <div>
                    <h3 className="crud-bar-title">Accommodations</h3>
                    <p className="crud-bar-note">
                        Prices, capacity and how many of each unit exist. The booking page reads
                        these directly.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <button
                        type="button"
                        className="crud-btn"
                        onClick={() =>
                            setEditingBanner({
                                messages: banner.messages.join('\n'),
                                isActive: banner.isActive,
                            })
                        }
                    >
                        Promo banner
                        {banner.isActive && <span className="acc-manage-banner-dot" aria-hidden="true" />}
                    </button>
                    <button
                        type="button"
                        className="crud-btn is-primary"
                        onClick={() => setEditingType(BLANK_TYPE)}
                    >
                        + Add an accommodation
                    </button>
                </div>
            </div>

            {/* What the home page is currently scrolling, spelled out here so
                staff can see a live banner without opening the site — the one
                piece of copy most likely to be left running after the sale. */}
            {banner.isActive && banner.messages.length > 0 && (
                <p className="acc-manage-banner-live">
                    <strong>Promo banner is live:</strong> {banner.messages.join(' · ')}
                </p>
            )}

            {catalog.error && <p className="crud-message is-error">{catalog.error}</p>}

            {catalog.types.length === 0 ? (
                <p className="crud-empty">
                    {catalog.loaded
                        ? 'No accommodations yet. Add the first one above.'
                        : 'Loading the accommodation catalog…'}
                </p>
            ) : (
                <div className="acc-manage-list">
                    {catalog.types.map((type) => (
                        <article
                            key={type.id}
                            className={`acc-manage-card ${type.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="acc-manage-card-head">
                                <div className="acc-manage-thumb">
                                    {/* The same photo a guest is shown, bundled
                                        or uploaded, so staff can see at a glance
                                        which units still need one. */}
                                    {resolveAccommodationImage(type.id, type.imageUrl) ? (
                                        <img src={resolveAccommodationImage(type.id, type.imageUrl)} alt="" />
                                    ) : (
                                        <span>{type.prefix}</span>
                                    )}
                                </div>
                                <div className="acc-manage-title">
                                    <h4>
                                        {type.name}
                                        {!type.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                    </h4>
                                    <p className="acc-manage-meta">
                                        {type.total} {type.total === 1 ? 'unit' : 'units'} · ids{' '}
                                        {type.prefix}-01…
                                        {/* A type sharing another's pool books against ITS units —
                                            the tents are three products over four camping slots —
                                            so a unit count of its own would be a double count. */}
                                        {type.poolId && type.poolId !== type.id && (
                                            <> · shares the <strong>{type.poolId}</strong> slots</>
                                        )}
                                    </p>
                                    {/* The single most likely reason a newly added
                                        accommodation is nowhere to be seen: a unit
                                        with no rate cannot be booked, so neither the
                                        home page nor the booking page offers it. */}
                                    {!RATE_GROUPS.some((group) => rateFor(type.id, group.id)) && (
                                        <p className="acc-manage-warning">
                                            Not shown to guests yet — set a price under a schedule below.
                                        </p>
                                    )}
                                </div>
                                <div className="crud-row-actions">
                                    <button
                                        type="button"
                                        className="crud-btn is-small"
                                        onClick={() => setEditingType(typeToDraft(type))}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>

                            <div className="acc-manage-rates">
                                {RATE_GROUPS.map((group) => {
                                    const rate = rateFor(type.id, group.id)
                                    return (
                                        <div className="acc-manage-rate" key={group.id}>
                                            <div className="acc-manage-rate-info">
                                                <span className="acc-manage-rate-group">{group.label}</span>
                                                <span className="acc-manage-rate-schedule">{group.schedules}</span>
                                            </div>
                                            {rate ? (
                                                <>
                                                    {/* The same thing a guest is
                                                        shown: with a promo on,
                                                        the standing rate struck
                                                        through and the promo
                                                        beside it. Staff can see
                                                        at a glance which rates
                                                        are currently discounted
                                                        without opening each. */}
                                                    <span className="acc-manage-rate-price">
                                                        {rate.promoActive && rate.promoPrice != null ? (
                                                            <>
                                                                <s className="acc-manage-rate-was">
                                                                    {formatPeso(rate.price)}
                                                                </s>
                                                                {formatPeso(rate.promoPrice)}
                                                                <span className="acc-manage-rate-promo">
                                                                    Promo
                                                                </span>
                                                            </>
                                                        ) : (
                                                            formatPeso(rate.price)
                                                        )}
                                                    </span>
                                                    <span className="acc-manage-rate-pax">
                                                        {rate.paxLabel || 'No capacity set'}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="acc-manage-rate-none">
                                                    Not offered under this schedule
                                                </span>
                                            )}
                                            <div className="crud-row-actions">
                                                <button
                                                    type="button"
                                                    className="crud-btn is-small"
                                                    onClick={() =>
                                                        setEditingRate({
                                                            ...rateToDraft(type.id, group.id, rate),
                                                            typeName: type.name,
                                                            groupLabel: group.label,
                                                            exists: Boolean(rate),
                                                        })
                                                    }
                                                >
                                                    {rate ? 'Edit price' : 'Set a price'}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editingType && (
                <CrudModal
                    title={editingType.id ? 'Edit accommodation' : 'New accommodation'}
                    subtitle={
                        editingType.id
                            ? 'Raising the number of units creates the missing ones. Lowering it retires '
                              + 'the spare ones — any with a booking on them are kept and simply stop being offered.'
                            : 'Add its price under each stay schedule after saving — a unit with no price '
                              + 'is not offered on the booking page.'
                    }
                    fields={typeFields}
                    initial={editingType}
                    submitLabel={editingType.id ? 'Save changes' : 'Add accommodation'}
                    onSubmit={saveAccommodationType}
                    onDelete={editingType.id ? () => deleteAccommodationType(editingType.id) : null}
                    deleteLabel="Delete accommodation"
                    onClose={() => setEditingType(null)}
                />
            )}

            {editingRate && (
                <CrudModal
                    title={`${editingRate.groupLabel} rate`}
                    subtitle={`What one ${editingRate.typeName} costs under the ${editingRate.groupLabel.toLowerCase()} schedules.`}
                    fields={rateFields}
                    initial={editingRate}
                    submitLabel="Save rate"
                    onSubmit={saveAccommodationRate}
                    // Removing the rate is how a unit stops being sold under one
                    // schedule while staying on sale under the other.
                    onDelete={
                        editingRate.exists
                            ? () => deleteAccommodationRate(editingRate.typeId, editingRate.rateGroup)
                            : null
                    }
                    deleteLabel="Stop offering it"
                    onClose={() => setEditingRate(null)}
                />
            )}

            {editingBanner && (
                <CrudModal
                    title="Promo banner"
                    subtitle="The scrolling strip above the accommodations on the home page. Unticking the box takes it down and keeps the wording for next time."
                    fields={bannerFields}
                    initial={editingBanner}
                    submitLabel="Save banner"
                    onSubmit={savePromoMarquee}
                    onClose={() => setEditingBanner(null)}
                />
            )}
        </div>
    )
}
