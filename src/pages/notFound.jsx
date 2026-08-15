// ============================================================================
//  Camp Ba-long — the page for a URL that does not exist
// ----------------------------------------------------------------------------
//  What used to be here was `null`: an unmatched path rendered the header and
//  then nothing at all. A guest who mistyped /menu got a blank cream page with
//  no way to tell whether the site was broken or still loading, and a crawler
//  got an empty page it had every reason to index.
//
//  ABOUT THE STATUS CODE
//  ---------------------
//  This returns HTTP 200, not 404, and cannot do otherwise. The host is
//  configured to answer every unmatched path with index.html — that is what
//  makes a deep link like /booking work at all in a single-page app — so by
//  the time React knows the path is wrong, the response is long since sent.
//  Google calls that a soft 404.
//
//  The noindex below is the actual fix, and it is the fix Google documents for
//  this case: a page that says "do not index me" is dropped from the index
//  whatever status code carried it. Returning a true 404 would need the server
//  to know the route table, which means server-side rendering — a large change
//  to buy a status code nobody sees.
// ============================================================================

import { Link } from 'react-router'
import Seo from '../components/Seo.jsx'
import Footer from '../components/footer'
import './notFound.css'

function NotFound() {
    return (
        <>
            {/* No path prop: this page is not in the route table, so it gets
                its title from here and no canonical link at all. */}
            <Seo
                noindex
                title="Page not found | Camp Ba-long Nature Farm & Resort"
                description="That page does not exist. Head back to Camp Ba-long to browse accommodations, the menu and spa services."
            />
            <main className="page not-found-page">
                <div className="not-found-shell">
                    <p className="not-found-code">404</p>
                    <h1 className="not-found-title">We couldn&rsquo;t find that page</h1>
                    <p className="not-found-text">
                        The link may be out of date, or the address mistyped. Everything
                        below is still where you left it.
                    </p>

                    <nav className="not-found-links" aria-label="Main pages">
                        <Link className="not-found-cta" to="/">Back to home</Link>
                        <Link className="not-found-link" to="/booking">Book a stay</Link>
                        <Link className="not-found-link" to="/menu">Food menu</Link>
                        <Link className="not-found-link" to="/spa">Spa services</Link>
                        <Link className="not-found-link" to="/my-booking">My booking</Link>
                    </nav>
                </div>
            </main>
            <Footer />
        </>
    )
}

export default NotFound
