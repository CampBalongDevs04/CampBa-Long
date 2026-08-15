import '../css/cmsPage.css'

// What a page in the CMS picker shows before its editors exist — its copy
// still written into the page file, so changing it is still a code change and
// a redeploy.
//
// NOTHING RENDERS THIS TODAY. Spa Service had it, then My Booking, and both
// now have real panels; it is kept for the next page added to cmsPages.js
// ahead of its editors, which is the order every page so far has arrived in.
// A page left out of the picker looks like a page nobody can edit; a page in
// it with this panel behind says which it is, and says the same thing to
// whoever builds the editors next. Its partner is the "Not set up" badge in
// cmsPageTab.jsx, which the same empty `sections` array drives.
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
