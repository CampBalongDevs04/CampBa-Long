import { useState } from 'react'
import '../components/css/footer.css'

const FooterInfo = [
    {
        resortName: "Camp Ba-long",
        resortDescription: "Where you can connect with your inner peace! Immerse yourself in the healing waters, surrounded by lush tropical forest. The perfect place to unwind, rejuvenate your body, and calm your mind.",
        resortTitle: "be Updated",
        descriotion: "Camp Ba-Long Nature Farm: A Refreshing Nature Escape Discover a hidden paradise where crystal-clear spring waters, lush tropical landscapes, and peaceful surroundings come together to create the perfect getaway. Camp Ba-Long Nature Farm invites you to relax, refresh, and reconnect with nature in an unforgettable outdoor experience.",
    }

]
const FooterOther = [
    {
        title: "Discover Camp Ba-long",
        Choices: [
            { label: "Main Wing", href: "/" },
            { label: "Camp-Balong", href: "/" },
            { label: "Accommodations", href: "/#accommodations" },
            { label: "Contact US", href: "/#contact" },
        ],
    }

]

const GetInTouch = [
    {
        contact: "09622331708",
        Email: "campbalongnaturefarm@gmail.com",
        socials: [
            { label: "Facebook", href: "https://facebook.com/campbalong" },
            { label: "Instagram", href: "https://instagram.com/campbalong" },
        ],
    }
]

const TERMS_TEXT = "By booking or staying at Camp Ba-long, you agree to arrive within your reserved schedule, respect the property and fellow guests, and settle any damages caused during your stay. Reservations may be rescheduled or cancelled under the terms provided at the time of booking. Camp Ba-long reserves the right to refuse service to anyone who violates these terms."

const COPYRIGHT_TEXT = "All content on this site, including photos, text, and the Camp Ba-long name and logo, is owned by Camp Ba-long Nature Farm & Resort and may not be copied, reproduced, or distributed without written permission."

export default function Footer(){
    const [activeModal, setActiveModal] = useState(null)
    const year = new Date().getFullYear()

    return (
        <>
            <section className="footer-section">
                <footer className="footer">
                    <div className="footer-content">
                        <div className="footer-column footer-about">
                            <h3 className="footer-title">{FooterInfo[0].resortName}</h3>
                            <p className="footer-description">{FooterInfo[0].resortDescription}</p>
                            <p className="footer-eyebrow">{FooterInfo[0].resortTitle}</p>
                            <p className="footer-description">{FooterInfo[0].descriotion}</p>
                        </div>

                        <div className="footer-column">
                            <h4 className="footer-heading">{FooterOther[0].title}</h4>
                            <ul className="footer-links">
                                {FooterOther[0].Choices.map((choice) => (
                                    <li key={choice.label}>
                                        <a href={choice.href}>{choice.label}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="footer-column">
                            <h4 className="footer-heading">Get in Touch</h4>
                            <ul className="footer-links">
                                <li>
                                    <a href={`tel:${GetInTouch[0].contact}`}>{GetInTouch[0].contact}</a>
                                </li>
                                <li>
                                    <a href={`mailto:${GetInTouch[0].Email}`}>{GetInTouch[0].Email}</a>
                                </li>
                            </ul>
                            <div className="footer-socials">
                                {GetInTouch[0].socials.map((social) => (
                                    <a
                                        key={social.label}
                                        className="footer-social-link"
                                        href={social.href}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {social.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="footer-bottom">
                        <p className="footer-copyright">&copy; {year} {FooterInfo[0].resortName}. All rights reserved.</p>
                        <div className="footer-legal">
                            <button type="button" className="footer-legal-link" onClick={() => setActiveModal('terms')}>
                                Terms &amp; Conditions
                            </button>
                            <button type="button" className="footer-legal-link" onClick={() => setActiveModal('copyright')}>
                                Copyright Policy
                            </button>
                        </div>
                    </div>
                </footer>
            </section>

            {activeModal && (
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
                        <h2 className="footer-modal-title">
                            {activeModal === 'terms' ? 'Terms & Conditions' : 'Copyright Policy'}
                        </h2>
                        <p className="footer-modal-text">
                            {activeModal === 'terms' ? TERMS_TEXT : COPYRIGHT_TEXT}
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}
