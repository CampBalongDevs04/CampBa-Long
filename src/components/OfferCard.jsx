export default function OfferCard({ imageUrl, altText, icon: Icon, title, description, link = "#" }) {
    return (
        <article className="offer-card">
            <div className="card-media">
                <img src={imageUrl} alt={altText} />
            </div>
            <div className="card-body">
                <div className="card-icon">
                    <Icon />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <a href={link} className="discover-btn">Discover More</a>
            </div>
        </article>
    );
}