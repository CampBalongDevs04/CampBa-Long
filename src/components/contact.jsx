import './css/contact.css'
import LotusDividerIcon from './LotusDividerIcon'
import emailSvg from '../assets/svg/email.svg'
import phoneSvg from '../assets/svg/phone.svg'
import timeSvg from '../assets/svg/time.svg'





export default function Contact(){
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
                                <p className="contact-detail-info">+63 9xxxxxxxxxx</p>
                            </div>
                        </div>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                               <img src={emailSvg} alt="email icon" />
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Email</p>
                                <p className="contact-detail-info">campBalongExample@gmail.com</p>
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

                    <form className="contact-container">
                        <div className="contact-field">
                            <label htmlFor="name">Name</label>
                            <input type="text" id="name" name="name" placeholder="Enter your name" required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="email">Email</label>
                            <input type="email" id="email" name="email" placeholder="Enter your email" required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="phonenumber">Phone Number</label>
                            <input type="tel" id="phonenumber" name="phonenumber" placeholder="Enter your phone number" required />
                        </div>

                        <div className="contact-field">
                            <label htmlFor="message">Message</label>
                            <textarea id="message" name="message" rows="5" placeholder="Enter your message" required></textarea>
                        </div>

                        <button type="submit" className="contact-submit-btn">Send Message</button>
                    </form>
                </div>
            </section>
        </>
    )
}
