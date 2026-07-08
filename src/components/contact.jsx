import './css/contact.css'
import LotusDividerIcon from './LotusDividerIcon'



export default function Contact(){
    return(
        <>
            <section className="contact-section">
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
                                {/* drop an SVG icon here */}
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Phone</p>
                                <p className="contact-detail-info">+63 9xxxxxxxxxx</p>
                            </div>
                        </div>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                                {/* drop an SVG icon here */}
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Email</p>
                                <p className="contact-detail-info">campBalongExample@gmail.com</p>
                            </div>
                        </div>

                        <div className="contact-detail">
                            <div className="contact-detail-icon">
                                {/* drop an SVG icon here */}
                            </div>
                            <div className="contact-detail-text">
                                <p className="contact-detail-label">Hours</p>
                                <p className="contact-detail-info">Open daily, 8:00 AM &ndash; 8:00 PM</p>
                            </div>
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
