export default function TagItem({ icon: Icon, label }) {
    return (
        <div className="tag-item">
            <Icon />
            <span>{label}</span>
        </div>
    );
}