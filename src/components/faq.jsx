import { useState } from 'react'
import './css/faq.css'

const faqs = [
    {
        question: 'What are your check-in and check-out times?',
        answer: 'Check-in starts at 2:00 PM and check-out is until 12:00 NN. If you need an early check-in or late check-out, let us know ahead of time and we will do our best to accommodate you.',
    },
    {
        question: 'How do I book a stay?',
        answer: 'You can reserve your stay in just a few clicks through the Book Now button on our home page. Walk-ins are welcome, but we recommend booking in advance to secure your preferred room and dates.',
    },
    {
        question: 'What amenities are included with my stay?',
        answer: 'All stays include access to our swimming pools, gardens, and common lounge areas. Spa services, dining, and special experiences are available on-site and can be added to your booking.',
    },
    {
        question: 'Is food available at the resort?',
        answer: 'Yes! Our restaurant serves a variety of cuisines from breakfast to dinner. You can browse the full menu on our Food Menu page and order during your stay.',
    },
    {
        question: 'Do you accommodate events and group bookings?',
        answer: 'Absolutely. Camp Ba-long is a great venue for family reunions, team buildings, and celebrations. Reach out through our contact form and we will help you plan your event.',
    },
    {
        question: 'Are pets allowed?',
        answer: 'Well-behaved pets are welcome in selected accommodations. Please mention your furry companion when booking so we can assign you a pet-friendly room.',
    },
    {
        question: 'What payment methods do you accept?',
        answer: 'We accept cash, major credit and debit cards, and popular e-wallets such as GCash. A down payment may be required to confirm reservations.',
    },
    {
        question: 'Can I cancel or reschedule my booking?',
        answer: 'Yes. You can manage your reservation through the My Booking page. Cancellations and rescheduling are free up to 48 hours before your check-in date.',
    },
]

function FAQ() {
    const [openIndex, setOpenIndex] = useState(null)

    const toggle = (index) => {
        setOpenIndex(openIndex === index ? null : index)
    }

    return (
        <section className="faq-section" id="faq">
            <div className="faq-inner">
                <div className="faq-intro">
                    <span className="faq-eyebrow">FAQ</span>
                    <h2 className="faq-title">Frequently Asked Questions</h2>
                    <p className="faq-text">
                        Planning your getaway? Here are the answers to the questions our
                        guests ask most, from booking and check-in to amenities and dining.
                        Can&apos;t find what you&apos;re looking for? We&apos;re happy to help.
                    </p>
                    <a className="faq-contact-btn" href="#contact">
                        <svg viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        Any questions? Reach out
                    </a>
                </div>

                <div className="faq-list">
                    {faqs.map((faq, index) => (
                        <div
                            className={'faq-item' + (openIndex === index ? ' open' : '')}
                            key={index}
                        >
                            <button
                                type="button"
                                className="faq-question"
                                onClick={() => toggle(index)}
                                aria-expanded={openIndex === index}
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
