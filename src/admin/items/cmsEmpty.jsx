import '../css/cmsPage.css'

// What Spa Service and My Booking show, because neither has anything to edit
// yet — their copy is still written into the page files and changing it is
// still a code change and a redeploy.
//
// They are in the picker anyway. A page left out of it looks like a page
// nobody can edit; a page in it with this panel behind says which it is, and
// says the same thing to whoever builds the editors next.
export default function CmsEmpty({ label, file }) {
    return (
        <div className="cms-empty-panel">
            <h3 className="cms-empty-title">{label} isn’t editable here yet</h3>
            <p className="cms-empty-text">
                The wording and photos on this page are still written into the site’s code,
                so changing them needs a developer and a redeploy — not this dashboard.
            </p>
            {file && (
                <p className="cms-empty-text">
                    They live in <span className="cms-empty-file">{file}</span>.
                </p>
            )}
        </div>
    )
}
