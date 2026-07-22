import '../css/spaServiceList.css'
import { hilotServices } from '../../pages/spaService.jsx'

// Service data is hardcoded in pages/spaService.jsx — this reads it directly
// so the admin always sees the same offerings (and prices) guests do.
export default function SpaServiceList() {
    return (
        <div className="spa-list-panel">
            <div className="spa-list-header">
                <h3 className="spa-list-title">Available Spa Services</h3>
                <span className="spa-list-count">{hilotServices.length} services</span>
            </div>

            <div className="spa-list-rows">
                {hilotServices.map((service) => (
                    <article key={service.name} className="spa-list-row">
                        <div className="spa-list-image">
                            <img src={service.image} alt={service.name} />
                        </div>
                        <div className="spa-list-info">
                            <h4 className="spa-list-name">{service.name}</h4>
                            <p className="spa-list-desc">{service.desc}</p>
                            {service.duration && (
                                <span className="spa-list-duration">{service.duration}</span>
                            )}
                        </div>
                        <span className="spa-list-price">
                            &#8369;{Number(service.price).toLocaleString('en-PH')}
                        </span>
                    </article>
                ))}
            </div>
        </div>
    )
}
