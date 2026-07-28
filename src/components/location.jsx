import { useState } from 'react'
import './css/location.css'
import LotusDividerIcon from './LotusDividerIcon'
import { Skeleton } from './skeletons/Skeleton.jsx'
import addressSvg from '../assets/svg/address.svg'
import phoneSvg from '../assets/svg/phone.svg'
import emailSvg from '../assets/svg/email.svg'
import adminSvg from '../assets/svg/admin.svg'
import carSvg from '../assets/svg/car.svg'
import transpoSvg from '../assets/svg/transpo.svg'
import routeSvg from '../assets/svg/route.svg'
import parkingSvg from '../assets/svg/parking.svg'


const contactDetails = [
    {
        icon: addressSvg,
        label: 'Address',
        lines: ['Brgy. Laguan', 'Liliw, Laguna', 'Philippines']
    },
    {
        icon: phoneSvg,
        label: 'Phone',
        lines: ['+63 9xxx xxx xxx']
    },
    {
        icon: emailSvg,
        label: 'Email',
        lines: ['campbalongnaturefarm@gmail.com']
    },
    {
        icon: adminSvg,
        label: 'Admin Hours',
        lines: ['Monday(Resort maintenance) Tuesday – Sunday: 10:00 AM – 5:00 PM']
    }
]

const locationFeatures = [
    {
        icon: carSvg,
        title: 'Easy to Reach',
        text: 'Conveniently located with easy access by car.'
    },
    {
        icon: transpoSvg,
        title: 'Public Transit',
        text: 'Close to major jeepney JODA and Tricycle TODA.'
    },
    {
        icon: parkingSvg,
        title: 'Parking Available',
        text: 'Free parking available for all guests.'
    },
    {
        icon: routeSvg,
        title: 'Scenic Route',
        text: 'A relaxing drive surrounded by nature.'
    }
]

export default function Location(){
    const [mapLoaded, setMapLoaded] = useState(false)

    return(
        <>
            <section className = "location-section">

                <div className = "location-header">
                    <LotusDividerIcon />
                    <p className = "location-eyebrow">Our Location</p>
                    <h1 className = "location-title">We&rsquo;d Love to See You</h1>
                    <p className = "location-sub">Visit us at Camp Ba-long. We&rsquo;re always happy to welcome you!</p>
                </div>

                <div className = "location-body">

                    <div className = "location-card">
                        {contactDetails.map(({icon, label, lines}, index) => (
                            <div className = "location-detail" key = {index}>
                                <span className = "location-detail-icon">
                                    {icon && <img src = {icon} alt = "icon" />}
                                </span>
                                <div className = "location-detail-text">
                                    <h3 className = "location-detail-label">{label}</h3>
                                    {lines.map((line, i) => (
                                        <p className = "location-information" key = {i}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <a className = "location-directions-btn" type = "button" href = "https://maps.app.goo.gl/69TemNpuTw41mkDo6">Get Directions</a>
                    </div>

                    <div className = "location-map">
                        <iframe
                            title = "Camp Ba-long Nature Farm map"
                            src = "https://maps.google.com/maps?q=Camp+Ba-long+Nature+Farm,+Liliw,+Laguna&ll=14.1263549,121.4312552&z=16&output=embed"
                            loading = "lazy"
                            allowFullScreen
                            referrerPolicy = "no-referrer-when-downgrade"
                            onLoad = {() => setMapLoaded(true)}
                        ></iframe>
                        {!mapLoaded && <Skeleton photo className="skel-img-cover" />}
                    </div>

                </div>

                <div className = "location-features">
                    {locationFeatures.map(({icon, title, text}, index) => (
                        <div className = "location-feature" key = {index}>
                            <span className = "location-feature-icon">
                                {icon && <img src = {icon} alt = "icon" />}
                            </span>
                            <h3 className = "location-feature-title">{title}</h3>
                            <p className = "location-feature-text">{text}</p>
                        </div>
                    ))}
                </div>

            </section>
        </>
    )
}
