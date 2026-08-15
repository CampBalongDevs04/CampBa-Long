import { useState } from 'react'
import '../css/sidebar.css'

function MenuIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    )
}

function OverviewIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
    )
}

function BookingsIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
    )
}

function UnitsIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
        </svg>
    )
}

function FoodMenuIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3v7a2 2 0 0 0 2 2v9" />
            <path d="M5 3v4M9 3v4" />
            <path d="M17 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" />
        </svg>
    )
}

function SpaIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21c-4 0-8-3-9-8 3 0 5 1 6.5 2.5C10 12 10.5 7 12 4c1.5 3 2 8 2.5 11.5C16 14 18 13 21 13c-1 5-5 8-9 8z" />
        </svg>
    )
}

function MaintenanceIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
        </svg>
    )
}

function CmsIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
    )
}

function ExportIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
    )
}

function LogoutIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    )
}

const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: <OverviewIcon /> },
    { id: 'bookings', label: 'Bookings', icon: <BookingsIcon /> },
    { id: 'units', label: 'Units', icon: <UnitsIcon /> },
    { id: 'menu', label: 'Food Menu', icon: <FoodMenuIcon /> },
    { id: 'spa', label: 'Spa', icon: <SpaIcon /> },
    // Not catalog and not copy: the weekly closure is an operating rule the
    // booking calendar is built on, so it gets its own place rather than being
    // buried in a CMS tab about wording.
    { id: 'maintenance', label: 'Maintenance', icon: <MaintenanceIcon /> },
    { id: 'cms', label: 'CMS', icon: <CmsIcon /> },
    { id: 'export', label: 'Export', icon: <ExportIcon /> },
]

function getInitials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('')
}

export default function AdminSidebar({ activeItem = '', onSelect, onLogout, profile }) {
    const [expanded, setExpanded] = useState(false)

    const handleSelect = (id) => {
        setExpanded(false)
        if (onSelect) onSelect(id)
    }

    return (
        <aside className={expanded ? 'admin-sidebar expanded' : 'admin-sidebar'}>
            <button
                type="button"
                className="sidebar-toggle"
                aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
            >
                <span className="sidebar-icon"><MenuIcon /></span>
                <span className="sidebar-label">Menu</span>
            </button>

            {profile && (
                <div className="sidebar-profile" title={profile.email || ''}>
                    <span className="sidebar-avatar">{getInitials(profile.name)}</span>
                    <span className="sidebar-profile-copy">
                        <span className="sidebar-profile-name">{profile.name}</span>
                        <span className="sidebar-profile-role">{profile.role}</span>
                    </span>
                </div>
            )}

            <nav className="sidebar-nav">
                {sidebarItems.map(({ id, label, icon }) => (
                    <button
                        key={id}
                        type="button"
                        className={activeItem === id ? 'sidebar-item active' : 'sidebar-item'}
                        title={label}
                        onClick={() => handleSelect(id)}
                    >
                        <span className="sidebar-icon">{icon}</span>
                        <span className="sidebar-label">{label}</span>
                    </button>
                ))}
            </nav>

            {onLogout && (
                <div className="sidebar-footer">
                    <button
                        type="button"
                        className="sidebar-item sidebar-logout"
                        title="Logout"
                        onClick={onLogout}
                    >
                        <span className="sidebar-icon"><LogoutIcon /></span>
                        <span className="sidebar-label">Logout</span>
                    </button>
                </div>
            )}
        </aside>
    )
}
