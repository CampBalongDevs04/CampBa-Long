import { useEffect, useState } from 'react'
import './css/contact.css'
import LotusDividerIcon from './LotusDividerIcon'
import EmailStatusModal from './EmailStatusModal'
import {
    sendContactMessage,
    describeEmailError,
    prefetchEmailConfig,
} from '../lib/emailClient.js'
import emailSvg from '../assets/svg/email.svg'
import phoneSvg from '../assets/svg/phone.svg'
import timeSvg from '../assets/svg/time.svg'


const EMPTY_FORM = { name: '', email: '', phonenumber: '', message: '' }



export default function Contact(){
    const [form, setForm] = useState(EMPTY_FORM)
    const [sending, setSending] = useState(false)
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
                    <p className="contact-eyebrow">Contact us</p>
                    <h1 className="contact-title">Got question in your mind?</h1>
                </div>

                <div className="contact-body">
                    <div className="contact-info">
                        <h2 className="contact-info-title">We&rsquo;d love to hear from you</h2>
                        <p className="contact-info-text">
                            Planning a stay, booking an event, or just curious about
                            Camp Ba-long? Send us a message and our team will get
                            back to you within 24 hours.
                        </p>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                                <img src={phoneSvg} alt ="phone icon" />
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Phone</p>
                                <p className="contact-detail-info">+63 9622331708</p>
                            </div>
                        </div>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                               <img src={emailSvg} alt="email icon" />
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Email</p>
                                <p className="contact-detail-info">campbalongnaturefarm@gmail.com</p>
                            </div>
                        </div>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                                <img src ={timeSvg} alt="time icon" />
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Hours</p>
                                <p className="contact-detail-info">Open daily, 8:00 AM &ndash; 8:00 PM</p>
                            </div>
                        </div>

                        <div className="Admin-Hours">
                            <h3 className="Admin-title">Admin Hours</h3>
                            <p className="Admin-text">Monday - Sunday 8AM - 5PM</p>
                            <p className="Note">
                                <span className="note-bold">Note: </span>
                                Booking confirmations and other administrative requests are processed only during
                                <span className="Admin-time"> 8:00 AM &ndash; 5:00 PM. </span>
                                Requests made outside these hours will be handled on the next business day.
                            </p>
                        </div>
                    </div>

                    <form className="contact-container" onSubmit={handleSubmit}>
                        <div className="contact-field">
                            <label htmlFor="name">Name</label>
                            <input type="text" id="name" name="name" placeholder="Enter your name"
                                value={form.name} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" name="email" placeholder="Enter your email"
                                value={form.email} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="phonenumber">Phone Number</label>
                            <input type="tel" id="phonenumber" name="phonenumber" placeholder="Enter your phone number"
                                value={form.phonenumber} onChange={updateField} disabled={sending} required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="message">Message</label>
                            <textarea id="message" name="message" rows="5" placeholder="Enter your message"
                                value={form.message} onChange={updateField} disabled={sending} required></textarea>
                        </div>

                        <button type="submit" className="contact-submit-btn" disabled={sending}>
                            {sending ? 'Sending…' : 'Send Message'}
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
