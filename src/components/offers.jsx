import './css/offers.css';
import OfferCard from './OfferCard';
import TagItem from './TagItem';
import LeafDeco from './LeafDeco';
import LotusDividerIcon from './LotusDividerIcon';
import PoolIcon from './PoolIcon';
import FoodIcon from './FoodIcon';
import SpaIcon from './SpaIcon';
import NatureIcon from './NatureIcon';
import RelaxationIcon from './RelaxationIcon';
import WellnessIcon from './WellnessIcon';

const offersData = [
    {
        imageUrl: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&q=80&auto=format&fit=crop",
        altText: "Natural theme pool surrounded by greenery",
        icon: PoolIcon,
        title: "Pool & Running Water",
        description: "Enjoy nature theme pools",
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80&auto=format&fit=crop",
        altText: "Local foods spread with fresh ingredients",
        icon: FoodIcon,
        title: "Foods",
        description: "Savor local flavors and fresh ingredients",
    },
    {
        imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&q=80&auto=format&fit=crop",
        altText: "Hot stone spa treatment",
        icon: SpaIcon,
        title: "Spa",
        description: "Relax, rejuvenate and refresh your senses",
    }
];

const tagsData = [
    { icon: NatureIcon, label: "Nature" },
    { icon: RelaxationIcon, label: "Relaxation" },
    { icon: WellnessIcon, label: "Wellness" },
];

export default function Offers() {
    return(
        <>
            <section className="offer-section">

                <div className="Welcome-header">
                    <h1 className="Welcome-title">Welcome to Camp Ba-long</h1>
                    <p className="Welcome-description">Where you can connect with your inner peace!</p>
                </div>


                <LeafDeco className="tl" />
                <LeafDeco className="tr" />
                <LeafDeco className="bl" />
                <LeafDeco className="br" />
    
                <header className="offer-header">
                    <LotusDividerIcon />
                    <h1 className="offer-title">What We Offer</h1>
                    <p className="offer-sub">• Unwind. Indulge. Reconnect. <span className="highlight">All in one place</span> •</p>
                </header>
    
                <div className="cards-grid">
                    {offersData.map((offer) => (
                        <OfferCard key={offer.title} {...offer} />
                    ))}
                </div>
    
                <div className="tags-row">
                    {tagsData.map((tag) => (
                        <TagItem key={tag.label} {...tag} />
                    ))}
                </div>

                

            </section>
        </>
    )
}
