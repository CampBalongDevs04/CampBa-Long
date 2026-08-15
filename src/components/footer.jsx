import { useState } from 'react'
import '../components/css/footer.css'
import { useFooter } from '../data/footerSection.js'

// The footer's words, its two link lists and the Terms & Conditions and
// Copyright Policy behind the bottom bar come from three tables, written in the
// dashboard's CMS → Footer — see data/footerSection.js. They used to be four
// consts in this file, which made rewording the terms a commit and a redeploy.
//
// Unlike the other CMS blocks this one is at the bottom of every page, so the
// resort name and the two legal labels fall back to the shipped wording rather
// than to nothing.

// A menu link staff have pointed at another site opens in a new tab; the
// internal ones do not. That distinction did not exist while the list was
// hardcoded and all four were paths.
function isExternal(href) {
    return /^https?:\/\//i.test(href)
}

export default function Footer(){
    const [activeModal, setActiveModal] = useState(null)
    const year = new Date().getFullYear()
    const { section, activeLinks, activeSocials } = useFooter()

    // Which panel the bottom bar has open, resolved once so the button and the
    // heading inside it cannot disagree.
    const panel =
        activeModal === 'terms'
            ? { title: section.termsLabel, text: section.termsText }
            : activeModal === 'policy'
              ? { title: section.policyLabel, text: section.policyText }
              : null

    return (
        <>
            <section className="footer-section">
                <footer className="footer">
                    <div className="footer-content">
                        <div className="footer-column footer-about">
                            <h3 className="footer-title">{section.resortName}</h3>
                            {section.aboutText && (
                                <p className="footer-description">{section.aboutText}</p>
                            )}
                            {section.updatesTitle && (
                                <p className="footer-eyebrow">{section.updatesTitle}</p>
                            )}
                            {section.updatesText && (
                                <p className="footer-description">{section.updatesText}</p>
                            )}
                        </div>

                        <div className="footer-column">
                            {section.linksTitle && (
                                <h4 className="footer-heading">{section.linksTitle}</h4>
                            )}
                            <ul className="footer-links">
                                {activeLinks.map((link) => (
                                    <li key={link.id}>
                                        <a
                                            href={link.href}
                                            {...(isExternal(link.href)
                                                ? { target: '_blank', rel: 'noreferrer' }
                                                : {})}
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="footer-column">
                            {section.touchTitle && (
                                <h4 className="footer-heading">{section.touchTitle}</h4>
                            )}
                            <ul className="footer-links">
                                {/* The tel: and mailto: links are built from
                                    what is typed, so a number saved with spaces
                                    is a number that still dials. */}
                                {section.phone && (
                                    <li>
                                        <a href={`tel:${section.phone}`}>{section.phone}</a>
                                    </li>
                                )}
                                {section.email && (
                                    <li>
                                        <a href={`mailto:${section.email}`}>{section.email}</a>
                                    </li>
                                )}
                            </ul>
                            {activeSocials.length > 0 && (
                                <div className="footer-socials">
                                    {activeSocials.map((social) => (
                                        <a
                                            key={social.id}
                                            className="footer-social-link"
                                            href={social.href}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {social.label}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="footer-bottom">
                        {/* The year is read off the clock, not stored: one typed
                            into a field is wrong every January. */}
                        <p className="footer-copyright">
                            &copy; {year} {section.resortName}. {section.copyrightSuffix}
                        </p>
                        <div className="footer-legal">
                            {/* A panel with nothing in it is not offered — an
                                empty overlay reads as a broken button. */}
                            {section.termsText && (
                                <button type="button" className="footer-legal-link" onClick={() => setActiveModal('terms')}>
                                    {section.termsLabel}
                                </button>
                            )}
                            {section.policyText && (
                                <button type="button" className="footer-legal-link" onClick={() => setActiveModal('policy')}>
                                    {section.policyLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </footer>
            </section>

            {panel && (
                <div className="footer-modal-overlay" onClick={() => setActiveModal(null)}>
                    <div className="footer-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="footer-modal-close"
                            aria-label="Close"
                            onClick={() => setActiveModal(null)}
                        >
                            &times;
                        </button>
                        <h2 className="footer-modal-title">{panel.title}</h2>
                        <p className="footer-modal-text">{panel.text}</p>
                    </div>
                </div>
            )}
        </>
    )
}
