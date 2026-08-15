import { useEffect, useState } from 'react'
import '../css/addonsManage.css'
import '../css/crud.css'
import CrudModal from './crud/CrudModal.jsx'
import {
    useAdminCatalog,
    loadAdminCatalog,
    saveResortAddonItem,
    deleteResortAddonItem,
} from '../../data/menuDB.js'

function addonFields(values) {
    return [
        { name: 'name', label: 'Add-on', placeholder: 'Towel' },
        {
            name: 'desc',
            label: 'Description',
            type: 'textarea',
            placeholder: 'One bath towel.',
        },
        [
            { name: 'price', label: 'Price (PHP)', type: 'number', placeholder: '100' },
            {
                name: 'stockTotal',
                label: 'How many exist',
                type: 'number',
                placeholder: 'Leave blank for no limit',
                help: 'The ceiling on requests whose stays overlap. Blank means unlimited.',
            },
        ],
        {
            name: 'imageUrl',
            label: 'Photo',
            type: 'image',
            folder: 'addons',
            preview: values.imageUrl,
            help: 'Shown next to the add-on on the booking page. JPG, PNG or WebP, up to 5 MB.',
        },
        { name: 'sortOrder', label: 'Position', type: 'number', help: 'Lower shows first.' },
        { name: 'isActive', label: 'Offer this on the booking page', type: 'checkbox' },
    ]
}

const BLANK_ADDON = {
    id: null,
    name: '',
    desc: '',
    price: '',
    imageUrl: '',
    sortOrder: 0,
    isActive: true,
    stockTotal: '',
}

function toDraft(item) {
    return {
        id: item.id,
        name: item.name,
        desc: item.desc ?? '',
        price: String(item.price),
        imageUrl: item.imageUrl ?? '',
        sortOrder: item.sortOrder ?? 0,
        isActive: item.isActive,
        stockTotal: item.stockTotal == null ? '' : String(item.stockTotal),
    }
}

export default function AddonsManage() {
    const catalog = useAdminCatalog()
    const [editing, setEditing] = useState(null)

    useEffect(() => {
        loadAdminCatalog()
    }, [])

    const items = catalog.addons ?? []
    const offered = items.filter((item) => item.isActive).length

    return (
        <div className="addon-list-panel">
            <div className="addon-list-header">
                <div>
                    <h3 className="addon-list-title">Add-ons</h3>
                    <p className="addon-list-note">
                        The physical items offered under "Add anything to your stay?" on the booking
                        page.
                    </p>
                </div>
                <div className="crud-row-actions">
                    <span className="addon-list-count">{offered} offered</span>
                    <button
                        type="button"
                        className="crud-btn is-primary is-small"
                        onClick={() => setEditing(BLANK_ADDON)}
                    >
                        + Add an add-on
                    </button>
                </div>
            </div>

            {catalog.error && <p className="crud-message is-error">{catalog.error}</p>}

            {items.length === 0 ? (
                <p className="crud-empty">
                    {catalog.loaded
                        ? 'No add-ons in the catalog yet. Add the first one above.'
                        : 'Loading the add-on catalog…'}
                </p>
            ) : (
                <div className="addon-list-rows">
                    {items.map((item) => (
                        <article
                            key={item.id}
                            className={`addon-list-row ${item.isActive ? '' : 'crud-is-hidden'}`}
                        >
                            <div className="addon-list-image">
                                {item.image ? (
                                    <img src={item.image} alt={item.name} />
                                ) : (
                                    <span className="addon-list-image-empty">No photo</span>
                                )}
                            </div>
                            <div className="addon-list-info">
                                <h4 className="addon-list-name">
                                    {item.name}
                                    {!item.isActive && <span className="crud-hidden-tag">Hidden</span>}
                                </h4>
                                {item.desc && <p className="addon-list-desc">{item.desc}</p>}
                            </div>
                            <span className="addon-list-price">
                                &#8369;{Number(item.price).toLocaleString('en-PH')}
                            </span>
                            <div className="crud-row-actions">
                                <button
                                    type="button"
                                    className="crud-btn is-small"
                                    onClick={() => setEditing(toDraft(item))}
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
                    title={editing.id ? 'Edit add-on' : 'New add-on'}
                    subtitle={
                        editing.id
                            ? 'The booking page follows this immediately — name, price and photo alike.'
                            : 'This appears under "Add anything to your stay?" as soon as you save it.'
                    }
                    fields={addonFields}
                    initial={editing}
                    submitLabel={editing.id ? 'Save changes' : 'Add add-on'}
                    onSubmit={saveResortAddonItem}
                    onDelete={editing.id ? () => deleteResortAddonItem(editing.id) : null}
                    deleteLabel="Delete add-on"
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
