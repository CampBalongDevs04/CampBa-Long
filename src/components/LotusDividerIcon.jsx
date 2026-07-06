export default function LotusDividerIcon() {
    return (
        <div className="lotus-divider">
            <span className="rule left"></span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4">
                <path d="M12 3c2 3 2 7 0 10 -2 -3 -2 -7 0 -10Z"/>
                <path d="M4 12c3 -1.5 6.5 -1.5 8 1 -3 1.5 -6.5 1.5 -8 -1Z"/>
                <path d="M20 12c-3 -1.5 -6.5 -1.5 -8 1 3 1.5 6.5 1.5 8 -1Z"/>
                <path d="M12 13v7"/>
            </svg>
            <span className="rule right"></span>
        </div>
    );
}