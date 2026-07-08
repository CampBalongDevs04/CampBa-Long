function FoodMenuPage({ onBack }) {
    return (
        <main style={{ minHeight: '100vh', background: '#fff', padding: '2rem 1.5rem 3rem' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <button
                    type="button"
                    onClick={onBack}
                    style={{
                        border: '1px solid #d1d5db',
                        background: '#fff',
                        padding: '0.7rem 1rem',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        marginBottom: '1.5rem',
                        fontWeight: 600,
                    }}
                >
                    ← Back to Home
                </button>

                <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#1f2937' }}>Food Menu</h1>
                <p style={{ fontSize: '1rem', lineHeight: 1.7, color: '#6b7280' }}>
                    This is your dedicated food page. The header stays visible while the rest of the page is a clean white canvas for your menu content.
                </p>
            </div>
        </main>
    )
}

export default FoodMenuPage
