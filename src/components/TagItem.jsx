import CmsIcon from './CmsIcon.jsx';

// One chip in the small row under the offer cards. Its icon is named by a row
// in offer_tags rather than imported here — see data/offersSection.js.
export default function TagItem({ iconKey, iconUrl, label }) {
    return (
        <div className="tag-item">
            <CmsIcon iconKey={iconKey} iconUrl={iconUrl} />
            <span>{label}</span>
        </div>
    );
}
