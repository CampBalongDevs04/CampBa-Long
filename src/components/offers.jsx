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
import RiverImage from '../assets/images/river.png';
import PoolImage from '../assets/images/pool.png';
import ForestImage from '../assets/images/forest.png';
import leafSvg from '../assets/svg/leaf.svg';
import familySvg from '../assets/svg/family.svg';
import cameraSvg from '../assets/svg/camera.svg';
import heartSvg from '../assets/svg/heart.svg'


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

const resortFeatures = [
    {
        image: PoolImage,
        altText: "Refreshing pool at Camp Ba-long",
        icon: PoolIcon,
        title: "Refreshing Pool",
        description: "Enjoy the cool, crystal-clear waters and peaceful atmosphere that make every visit refreshing and enjoyable.",
    },
    {
        image: RiverImage,
        altText: "Scenic river surrounded by nature",
        icon: NatureIcon,
        title: "Scenic Nature",
        description: "Enjoy the fresh air, lush greenery, and soothing sounds of nature. A peaceful escape from the busy world.",
    },
    {
        image: ForestImage,
        altText: "Relaxing forest ambiance",
        icon: RelaxationIcon,
        title: "Relaxing Ambiance",
        description: "Whether you're here to soak, meditate, or simply relax, our hot springs offer the perfect balance of tranquility and nature.",
    },
];

const tags = [

    {
        title: "Nature-Inspired Escape",
        description: "Relax and reconnect",
        icon: leafSvg,
    },
    {
        title: "Family Friendly",
        description: "Perfect for all ages",
        icon: familySvg,

    },
    {
        title: "Scenic & Serene",
        description: "Reconnect with nature",
        icon: cameraSvg,
    },
    {
        title: "Wellness Retreat",
        description: "Relax yourself",
        icon: heartSvg,
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
                    <LotusDividerIcon />
                    <h1 className="Welcome-message">• A HIDDEN PARADISE IN NATURE •</h1>
                    <p className="Welcome-description">Immerse yourself in the healing waters , surrounded by lush tropical forest. The perfect place to unwind, rejuvenate your body, and calm your mind.</p>
                    <div className="Resort-images">
                        {resortFeatures.map(({ image, altText, icon: Icon, title, description }) => (
                            <figure className="resort-item" key={title}>
                                <img src={image} alt={altText} />
                                <div className="resort-feature">
                                    <span className="feature-icon"><Icon /></span>
                                    <div className="feature-text">
                                        <h3>{title}</h3>
                                        <p>{description}</p>
                                    </div>
                                </div>
                            </figure>
                        ))}
                    </div>

                    <div className="tag-card">
                        {tags.map(({ icon,title, description }) => (
                            <div className="tag-item" key={title}>
                                <span className="tag-icon"><img src={icon} alt="" /></span>
                                <h3>{title}</h3>
                                <p>{description}</p>
                            </div>
                        ))}
                    </div>
                
                
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
