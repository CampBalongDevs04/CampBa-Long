import { useEffect, useState } from 'react'
import './css/contact.css'
import LotusDividerIcon from './LotusDividerIcon'
import CmsIcon from './CmsIcon.jsx'
import EmailStatusModal from './EmailStatusModal'
import {
    sendContactMessage,
    describeEmailError,
    prefetchEmailConfig,
} from '../lib/emailClient.js'
import { useContactSection } from '../data/contactSection.js'


const EMPTY_FORM = { name: '', email: '', phonenumber: '', message: '' }


// The words on this section come from two tables, written in the dashboard's
// CMS → Contact — see data/contactSection.js. That includes the form's labels
// and placeholders, and stops there: the field names below are what the email
// template reads, the input types are what open a phone keypad on a phone, and
// `required` is what stops an empty enquiry. The CMS can change what this form
// says and never what it does.

export default function Contact(){
    const [form, setForm] = useState(EMPTY_FORM)
    const [sending, setSending] = useState(false)
    const { section, activeDetails } = useContactSection()
    // null while idle, then 'success' | 'error' once a send has finished.
    const [result, setResult] = useState(null)
    const [resultMessage, setResultMessage] = useState('')

    // The EmailJS IDs live in Supabase now, so sending needs one read of that
    // row first. Starting it when the section mounts hides the round trip
    // behind the time the guest spends typing, instead of adding it to the
    // wait after they press Send. Nothing is reported if it fails here —
    // nothing has been submitted yet, and the send path retries and explains.
    useEffect(() => {
        prefetchEmailConfig()
    }, [])

    function updateField(event){
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
    }

    async function handleSubmit(event){
        // The form stays a real <form> with required inputs so the browser's
        // own validation runs first; preventDefault only stops the navigation
        // once those checks have passed.
        event.preventDefault()
        if (sending) return

        setSending(true)
        try {
            const { autoReplySent } = await sendContactMessage({
                name: form.name,
                email: form.email,
                phone: form.phonenumber,
                message: form.message,
            })

            setResult('success')
            setResultMessage(
                autoReplySent
                    ? 'Thank you for reaching out. Your message is with the Camp ' +
                      'Ba-long team and a confirmation is on its way to your inbox. ' +
                      'We reply within 24 hours during admin hours.'
                    // The enquiry landed but the acknowledgement did not, so the
                    // guest is told not to wait for an email that is not coming.
                    : 'Thank you for reaching out. Your message is with the Camp ' +
                      'Ba-long team and we reply within 24 hours during admin ' +
                      'hours. We could not send you a confirmation email, so ' +
                      'please keep a note of your enquiry.',
            )
            // Only cleared on success — a failed send must keep what the guest
            // typed so "try again" does not mean "type the whole thing again".
            setForm(EMPTY_FORM)
        } catch (error) {
            setResult('error')
            setResultMessage(describeEmailError(error))
        } finally {
            setSending(false)
        }
    }

    return(
        <>
            <section className="contact-section" id="contact">
                <div className="contact-header">
                    <LotusDividerIcon />
                    {section.eyebrow && <p className="contact-eyebrow">{section.eyebrow}</p>}
                    {section.title && <h2 className="contact-title">{section.title}</h2>}
                </div>

                <div className="contact-body">
                    <div className="contact-info">
                        {section.infoTitle && (
                            <h2 className="contact-info-title">{section.infoTitle}</h2>
                        )}
                        {section.infoText && (
                            <p className="contact-info-text">{section.infoText}</p>
                        )}

                        {activeDetails.map((detail) => (
                            <div className="contact-detail" key={detail.id}>
                                <div className="contact-detail-icon">
                                    <CmsIcon
                                        iconKey={detail.iconKey}
                                        iconUrl={detail.iconUrl}
                                        alt={`${detail.label} icon`}
                                    />
                                </div>
                                <div className="contact-detail-text">
                                    <p className="contact-detail-label">{detail.label}</p>
                                    <p className="contact-detail-info">{detail.info}</p>
                                </div>
                            </div>
                        ))}

                        {/* The panel goes entirely rather than sitting empty,
                            the same way the hero's feature strip does. */}
                        {(section.adminTitle || section.adminText || section.noteText) && (
                            <div className="Admin-Hours">
                                {section.adminTitle && (
                                    <h3 className="Admin-title">{section.adminTitle}</h3>
                                )}
                                {section.adminText && (
                                    <p className="Admin-text">{section.adminText}</p>
                                )}
                                {/* The spaces around each bold run are what
                                    separate it from the words either side —
                                    they belong to the sentence, not to what
                                    staff type into the fields. */}
                                <p className="Note">
                                    {section.noteLabel && (
                                        <span className="note-bold">{section.noteLabel} </span>
                                    )}
                                    {section.noteText}
                                    {section.noteHighlight && (
                                        <span className="Admin-time"> {section.noteHighlight} </span>
                                    )}
                                    {section.noteAfter}
                                </p>
                            </div>
                        )}
                    </div>

                    <form className="contact-container" onSubmit={handleSubmit}>
                        <div className="contact-field">
                            <label htmlFor="name">{section.formNameLabel}</label>
                            <input type="text" id="name" name="name" placeholder={section.formNamePlaceholder}
                                value={form.name} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="email">{section.formEmailLabel}</label>
                            <input type="email" id="email" name="email" placeholder={section.formEmailPlaceholder}
                                value={form.email} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="phonenumber">{section.formPhoneLabel}</label>
                            <input type="tel" id="phonenumber" name="phonenumber" placeholder={section.formPhonePlaceholder}
                                value={form.phonenumber} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="message">{section.formMessageLabel}</label>
                            <textarea id="message" name="message" rows="5" placeholder={section.formMessagePlaceholder}
                                value={form.message} onChange={updateField} disabled={sending} required></textarea>
                        </div>

                        <button type="submit" className="contact-submit-btn" disabled={sending}>
                            {sending ? section.formSendingLabel : section.formSubmitLabel}
                        </button>
                    </form>
                </div>
            </section>

            <EmailStatusModal
                status={result}
                message={resultMessage}
                onClose={() => setResult(null)}
            />
        </>
    )
}
