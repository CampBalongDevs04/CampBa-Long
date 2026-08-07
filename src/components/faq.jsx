import { useState } from 'react'
import './css/faq.css'
import { useFaqSection } from '../data/faqSection.js'

// The intro and the questions come from two tables, written in the dashboard's
// CMS → FAQ — see data/faqSection.js. They used to be an array in this file,
// which made correcting a price a commit and a redeploy. Until the tables land
// (and on a database that predates them) the store answers with the fourteen
// questions the site shipped with, so this block is never blank.

function FAQ() {
    // Keyed by id rather than by position: a question reordered or hidden from
    // the dashboard while a guest has one open must not silently swap which
    // answer is showing.
    const [openId, setOpenId] = useState(null)
    const { section, activeFaqs } = useFaqSection()

    const toggle = (id) => {
        setOpenId(openId === id ? null : id)
    }

    return (
        <section className="faq-section" id="faq">
            <div className="faq-inner">
                <div className="faq-intro">
                    {section.eyebrow && <span className="faq-eyebrow">{section.eyebrow}</span>}
                    {section.title && <h2 className="faq-title">{section.title}</h2>}
                    {section.description && <p className="faq-text">{section.description}</p>}
                    {/* No label means no button, the same rule the hero's two
                        buttons follow — a blank one would just sit there. */}
                    {section.contactLabel && (
                        <a className="faq-contact-btn" href={section.contactHref || '#contact'}>
                            <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {section.contactLabel}
                        </a>
                    )}
                </div>

                <div className="faq-list">
                    {activeFaqs.map((faq) => (
                        <div
                            className={'faq-item' + (openId === faq.id ? ' open' : '')}
                            key={faq.id}
                        >
                            <button
                                type="button"
                                className="faq-question"
                                onClick={() => toggle(faq.id)}
                                aria-expanded={openId === faq.id}
                            >
                                {faq.question}
                                <svg className="faq-chevron" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                                    <path d="M6 9l6 6 6-6"/>
                                </svg>
                            </button>
                            <div className="faq-answer">
                                <p>{faq.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export { FAQ }
export default FAQ
