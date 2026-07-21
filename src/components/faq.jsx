import { useState } from 'react'
import './css/faq.css'

const faqs = [
    {
        question: 'Location?',
        answer: 'We are located at Brgy. Laguan Liliw, Laguna',
    },
    {
        question: 'Is tent pitching allowed?',
        answer: 'Yes, tent pitching is allowed.',
    },
    {
        question: 'Are walk-ins allowed?',
        answer: "We allow walk-ins if we're not fully booked but it is better if you make reservations.",
    },
    {
        question: 'Do you have rooms?',
        answer: "We are a camp site so we don't have rooms but we do have teepees, A-houses and tents, where you can stay and sleep.",
    },
    {
        question: 'How much is the entrance fee?',
        answer: '150/ pax for day time, (10am-5pm) and 350/pax for 22 hours/ day and night (10am-8am) night and day (7pm-5am).',
    },
    {
        question: 'How much is the entrance fee for children?',
        answer: 'No entrance fee for children 7 years old and below.',
    },
    {
        question: 'How much is the cottage fee?',
        answer: 'Cottage fee is 2000, for day time (good for 8-10pax).',
    },
    {
        question: 'Is the parking lot far from the site?',
        answer: 'No, the distance between the parking lot to the gate was more or less 100 meters.',
    },
    {
        question: 'Can we check in and check out at our preferred time?',
        answer: 'No, checking in and out depends on your booked time, day time (10am-5pm) and night and day (7pm-5am).',

    },
    {
        question: 'Do you have parking?',
        answer: 'Yes, we have parking space.',
    },
    {
        question: 'Is Camp Ba-long Nature Resort a private resort?',
        answer: 'Our Place is a semi exclusive, we make sure that you enjoy yourselves without crowding. You may also rent the whole place for your group.',
    },
    {
        question: 'Is there a maximum number of persons allowed when you book the place exclusively for our group?',
        answer: 'We only allow a maximum of 60 pax for day time and 50 for Day and Night'
    },
    {
        question: 'Is cooking allowed?',
        answer: 'Yes, you may also rent a gas stove for 400 pesos and utensils for 200 pesos.'

    },
    {
        question: 'Can we order foods?',
        answer: 'Yes, you can order foods. Please message us for the menu and availability.'
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
