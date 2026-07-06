export default function LeafDeco({ className }) {
    const isTop = className.includes('t');
    return (
        <svg className={`leaf-deco ${className}`} viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
            <path d="M10,10 C60,0 120,40 130,100 C90,90 40,110 20,140 C15,90 -10,50 10,10 Z" fill="var(--leaf)" opacity={isTop ? "0.55" : "0.45"}/>
            { isTop && <path d="M10,10 C50,20 90,50 100,90" stroke="var(--forest)" strokeWidth="2" fill="none" opacity="0.4"/> }
        </svg>
    );
}