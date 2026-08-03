import { useEffect, useState } from 'react'
import '../css/spaServiceList.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useAdminCatalog,
    loadAdminCatalog,
    saveSpaService,
    deleteSpaService,
    resolveMenuImage,
    SPA_IMAGE_KEYS,
} from '../../data/menuDB.js'

// The spa price list, and where staff edit it. Same rows the guest spa page
// renders — it used to import a hardcoded array out of pages/spaService.jsx, so
// a price change was a code change.
//
// The list read here is the ADMIN one, which includes treatments switched off:
// a service taken off the guest page has to stay visible to whoever might put
// it back. useSpaServices() (the guest store) never carries them.

function spaFields() {
    return [
        { name: 'name', label: 'Treatment', placeholder: 'Traditional Body Massage' },
        {
            name: 'desc',
            label: 'Description',
            type: 'textarea',
            placeholder: 'Full-body Hilot massage rooted in Filipino healing traditions.',
        },
        [
            { name: 'price', label: 'Price (PHP)', type: 'number', placeholder: '650' },
            {
                name: 'duration',
                label: 'Duration',
                placeholder: '1hr 30mins',
                help: 'Shown on the card as written.',
            },
        ],
        [
            {
                name: 'imageKey',
                label: 'Photo',
                type: 'select',
                options: [
                    { value: '', label: 'No bundled photo' },
                    ...SPA_IMAGE_KEYS.map((key) => ({ value: key, label: key })),
                ],
                help: 'Photos shipped with the site.',
            },
            { name: 'sortOrder', label: 'Position', type: 'number', help: 'Lower shows first.' },
        ],
        {
            name: 'imageUrl',
            label: 'Photo link',
            type: 'url',
            placeholder: 'https://…',
            help: 'Used when no bundled photo is picked — for a treatment added after the site was built.',
        },
        { name: 'isActive', label: 'Offer this on the guest spa page', type: 'checkbox' },
    ]
}

const BLANK_SERVICE = {
    id: null,
    name: '',
    desc: '',
    price: '',
    duration: '',
    imageKey: '',
    imageUrl: '',
    sortOrder: 0,
    isActive: true,
}

function toDraft(service) {
    return {
        id: service.id,
        name: service.name,
        desc: service.desc ?? '',
        price: String(service.price),
        duration: service.duration ?? '',
        imageKey: service.imageKey ?? '',
        imageUrl: service.imageUrl ?? '',
        sortOrder: service.sortOrder ?? 0,
        isActive: service.isActive,
    }
}

export default function SpaServiceList() {
    const catalog = useAdminCatalog()
    const [editing, setEditing] = useState(null)

    useEffect(() => {
        loadAdminCatalog()
    }, [])

    const services = catalog.spa
    const offered = services.filter((service) => service.isActive).length

    return (
        <div className="spa-list-panel">
            <div className="spa-list-header">
                <h3 className="spa-list-title">Available Spa Services</h3>
                <div className="crud-row-actions">
                    <span className="spa-list-count">{offered} offered</span>
                    <button
                        type="button"
                        className="crud-btn is-primary is-small"
                        onClick={() => setEditing(BLANK_SERVICE)}
                    >
                        + Add a treatment
                    </button>
                </div>
            </div>

            {catalog.error && <p className="crud-message is-error">{catalog.error}</p>}

            {services.length === 0 ? (
                <p className="crud-empty">
                    {catalog.loaded
                        ? 'No treatments in the catalog yet. Add the first one above.'
                        : 'Loading the spa catalog…'}
                </p>
            ) : (
                <div className="spa-list-rows">
                    {services.map((service) => (
                        <article
                            key={service.id}
                            className={`spa-list-row ${service.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="spa-list-image">
                                {service.image ? (
                                    <img src={service.image} alt={service.name} />
                                ) : (
                                    <span className="spa-list-image-empty">No photo</span>
                                )}
                            </div>
                            <div className="spa-list-info">
                                <h4 className="spa-list-name">
                                    {service.name}
                                    {!service.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                <p className="spa-list-desc">{service.desc}</p>
                                {service.duration && (
                                    <span className="spa-list-duration">{service.duration}</span>
                                )}
                            </div>
                            <span className="spa-list-price">
                                &#8369;{Number(service.price).toLocaleString('en-PH')}
                            </span>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditing(toDraft(service))}
                                >
                                    Edit
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {editing && (
                <CrudModal
                    title={editing.id ? 'Edit treatment' : 'New treatment'}
                    subtitle={
                        editing.id
                            ? 'The guest spa page follows this price immediately. Treatments already '
                              + 'availed keep what they were charged.'
                            : 'This appears on the guest spa page as soon as you save it.'
                    }
                    fields={spaFields}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add treatment'}
                    onSubmit={saveSpaService}
                    onDelete={editing.id ? () => deleteSpaService(editing.id) : null}
                    deleteLabel="Delete treatment"
                    onClose={() => setEditing(null)}
                    renderPreview={(values) => {
                        const image = resolveMenuImage(values.imageKey, values.imageUrl)
                        if (!image) return null
                        return (
                            <div className="crud-image-preview">
                                <img src={image} alt="" />
                            </div>
                        )
                    }}
                />
            )}
        </div>
    )
}
