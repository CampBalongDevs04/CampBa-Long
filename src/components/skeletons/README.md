# Skeleton Loading — How to Add It to New Components

This guide covers how to give a **new component or page** skeleton loading using
the shared system in `src/components/skeletons/`.

> **Key idea:** skeletons are not automatic. React can't guess what your
> component looks like. A skeleton only shows when there's a real *async
> boundary* — a `lazy()` import, an image download, or your own `loading`
> state. A plain synchronous component renders instantly and needs no skeleton.

---

## Understand it first (plain language)

If you're new to this, read this section before the code.

### Why skeletons exist

When someone opens your site, the page isn't ready instantly — the browser has
to download code and images first. During that gap you have three choices:

1. **Show nothing** (blank white screen) → feels broken, people leave.
2. **Show a spinner** → better, but it tells you nothing about what's coming,
   and the page still "jumps" into place when it loads.
3. **Show a skeleton** → gray shimmering boxes shaped exactly like the real
   content. The person's brain goes "ah, a photo goes there, text goes here,
   it's loading" — it feels fast and calm.

A skeleton is basically a **gray preview of the page that hasn't arrived yet.**

### How it works (the stand-in actor)

Think of it like a **stand-in actor** on a movie set. While the real actor gets
ready, a stand-in of the same height stands in the exact same spot. When the
real actor walks in, the stand-in walks off. Same position, no chaos.

Three things make that happen in the code:

1. **The shimmer box.** The `Skeleton` component is just a gray rectangle with a
   shine sweeping across it (a CSS animation). That's all a skeleton really is —
   gray boxes.

2. **The swap.** React shows the gray box *while* something is loading, then
   automatically replaces it with the real thing when loading finishes:

   ```jsx
   if (!data) return <CardSkeleton />   // not ready yet → show gray box
   return <RealCard data={data} />      // ready → show real card
   ```

   React re-runs this whenever `data` changes. Empty → skeleton. Filled → real
   content. **You never manually hide the skeleton — it disappears by itself**
   the moment the real data shows up.

3. **Same size = no jumping.** Each skeleton is the exact same width, height, and
   spacing as the real content. So when the stand-in walks off and the real
   content walks on, nothing shifts. The page doesn't jolt.

### When a skeleton appears

The rule that trips people up, simplified:

> **A skeleton only shows when there's a real wait. No wait = no skeleton.**

There are exactly **three kinds of "wait"** in this app:

| The wait | What's loading | Example |
|----------|----------------|---------|
| A page opening | The page's code file downloads | Clicking "MENU" → food menu code loads |
| An image | The photo file downloads | Food photos, the round hero picture |
| Data (future) | Info comes from a database | When Supabase is added later |

If a component has **none** of those — it's just text/layout already there — it
appears instantly, and a skeleton would be a *fake delay that makes the site
feel slower.* Don't add one.

### One real example (clicking MENU)

1. The food menu's code isn't downloaded yet → React shows `FoodMenuSkeleton`
   (gray hero + gray cards).
2. The code arrives → the real menu replaces the skeleton.
3. Now the food *photos* download → each shows a gray shimmer via
   `SkeletonImage` until that photo arrives.
4. Photo arrives → shimmer vanishes, photo appears.

No blank screen, no jumping. That's the whole goal.

**Mental model:** gray stand-in of the right size → shows during a real wait →
React swaps in the real thing automatically when the wait ends. Everything in
these files is that one idea, in different shapes (cards, tables, forms, etc.).

---

## The 3 files

| File | What's in it |
|------|--------------|
| `Skeleton.jsx` | Primitives + 15 reusable building-block skeletons |
| `PageSkeletons.jsx` | Full-page skeletons, one per route |
| `skeleton.css` | Shimmer animation + all layout/tone classes (auto-imported by `Skeleton.jsx`) |

You only ever import from `Skeleton.jsx` (or `PageSkeletons.jsx` for routes).
The CSS comes along automatically.

---

## Pick your case

### Case 1 — A component that fetches / loads data

Show a matching skeleton while data is missing, real content once it arrives.
The skeleton disappears on its own because it's just an early `return`.

```jsx
import { useEffect, useState } from 'react'
import { CardRowSkeleton } from '../components/skeletons/Skeleton.jsx'

function MyThing() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchStuff().then(setData)
  }, [])

  // ⬇️ the ONE line you add — pick the skeleton that matches your layout
  if (!data) return <CardRowSkeleton count={3} />

  return <div>{/* real content using `data` */}</div>
}
```

### Case 2 — A new lazy-loaded child component

Wrap it in `<Suspense>` with a skeleton fallback. The skeleton shows while the
chunk downloads.

```jsx
import { Suspense, lazy } from 'react'
import { PanelSkeleton } from '../components/skeletons/Skeleton.jsx'

const Heavy = lazy(() => import('./Heavy.jsx'))

function Parent() {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <Heavy />
    </Suspense>
  )
}
```

### Case 3 — A new full page / route

Add a lazy route in [`src/App.jsx`](../../App.jsx) and give it a page skeleton.
For a whole page, add a dedicated skeleton to `PageSkeletons.jsx` (see
["Building a new page skeleton"](#building-a-new-page-skeleton) below).

```jsx
// in App.jsx
const NewPage = lazy(() => import('./pages/newPage.jsx'))

<Route path="/new" element={
  <Suspense fallback={<NewPageSkeleton />}><NewPage /></Suspense>
} />
```

### Case 4 — A component with images

Swap `<img>` for `<SkeletonImage>`. It shows a shimmer over the image area
until the file finishes downloading, then removes it.

```jsx
import { SkeletonImage } from '../components/skeletons/Skeleton.jsx'

<div className="my-image-wrapper">
  <SkeletonImage src={photo} alt="A description" loading="lazy" />
</div>
```

> ⚠️ **The wrapper must be `position: relative`.** The shimmer covers the
> wrapper. These wrappers already are: `.menu-food-image`, `.food-order-image`,
> `.accomodation-card-image`, `.spa-service-item`, `.card-media`,
> `.location-map`. For a **new** wrapper class, add `position: relative` to it
> in your CSS (or reuse `.skel-img-cover`'s host pattern).

---

## The building blocks (in `Skeleton.jsx`)

Reuse these before writing anything custom — they already match the design
system's colors, radii, shadows, and breakpoints.

### Primitives

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Skeleton` | One shimmer block | `width`, `height`, `circle`, `pill`, `text`, `onDark`, `photo`, `className`, `style` |
| `SkeletonText` | Stack of text lines (last is shorter) | `lines`, `gap`, `onDark`, `lineHeight`, `lastLineWidth` |
| `SkeletonImage` | `<img>` replacement with shimmer cover | all `<img>` props + `onLoad`/`onError` |
| `SkeletonStatus` | A11y wrapper — announces "Loading…" to screen readers | `label`, `children` |

### Composite skeletons

| Component | Mirrors | Key props |
|-----------|---------|-----------|
| `CardSkeleton` | One content card (image + text + button) | `withButton` |
| `CardRowSkeleton` | A row of content cards | `count`, `withButton` |
| `TableSkeleton` | Admin data table in a panel | `rows`, `cols` |
| `ListSkeleton` | List rows with a thumbnail | `rows` |
| `FormSkeleton` | Labeled fields + submit button | `fields`, `withButton` |
| `CalendarSkeleton` | Month calendar grid | — |
| `AccommodationListSkeleton` | Horizontal accommodation cards | `count` |
| `GallerySkeleton` | Editorial mosaic (first tile 2×2) | `items` |
| `HeroSkeleton` | Full-viewport dark hero | `titleLines`, `withCircle`, `withFeatures` |
| `BookingCardSkeleton` | One reservation card | — |
| `BookingSkeleton` | List of reservation cards | `count` |
| `SummarySkeleton` | Sticky booking-summary sidebar | — |
| `StatCardsSkeleton` | Admin stat-card row | `count` |
| `StatBoardSkeleton` | Overview stat board (revenue panel + counts + occupancy) | — |
| `TabsSkeleton` | Pill tab bar | `count` |
| `PanelSkeleton` | Cream panel, centered placeholder | — |

### `<Skeleton>` prop cheat sheet

```jsx
<Skeleton width={120} height={16} />        {/* fixed box */}
<Skeleton text width="70%" />               {/* text line */}
<Skeleton circle width={44} height={44} />  {/* avatar / icon */}
<Skeleton pill />                           {/* button / tag */}
<Skeleton photo className="my-hero" />      {/* image placeholder tone */}
<Skeleton onDark height={40} />             {/* lighter tone for dark backgrounds */}
```

- `width` / `height`: a number = pixels, a string = any CSS value (`"70%"`, `"2rem"`).
- `onDark`: use on forest/dark surfaces so the shimmer stays visible.
- `photo`: warmer tone that reads as "image loading here."

---

## Building a new page skeleton

Add a function to `PageSkeletons.jsx` that mirrors your page's real layout.
Two rules keep it faithful and shift-free:

1. **Wrap it in `SkeletonStatus`** for accessibility.
2. **Match the real dimensions** — same paddings, max-widths, gaps, and radii as
   the actual page's CSS, so content lands exactly where the placeholders were
   (no layout shift / low CLS).

```jsx
import { SkeletonStatus, HeroSkeleton, CardRowSkeleton, Skeleton } from './Skeleton.jsx'

export function NewPageSkeleton() {
  return (
    <SkeletonStatus label="Loading new page">
      <main aria-hidden="true">
        <HeroSkeleton titleLines={2} withCircle />
        <section className="skl-section">
          <Skeleton className="skl-section-title" />
          <CardRowSkeleton count={3} />
        </section>
      </main>
    </SkeletonStatus>
  )
}
```

Reusable layout classes already in `skeleton.css`: `.skl-section`,
`.skl-section-title`, `.skl-section-sub`, `.skl-card-row`, `.skl-page-hero`,
`.skl-page-title`, and more — grep the file for `.skl-` to see them all.

---

## Accessibility checklist

The shared components already handle these — keep them when you compose:

- **Announce loading:** wrap page-level skeletons in `<SkeletonStatus>` (adds
  `role="status"`, `aria-busy`, and a visually-hidden "Loading…" label).
- **Hide decoration:** shimmer blocks are `aria-hidden` so screen readers don't
  read empty boxes. (`<Skeleton>` sets this for you.)
- **No layout jump:** give skeletons the same size as the real content.
- **Reduced motion:** the shimmer auto-disables under
  `prefers-reduced-motion` — no action needed.

---

## Do / Don't

✅ **Do** reuse an existing composite before writing custom markup.
✅ **Do** match real sizes to avoid layout shift.
✅ **Do** use `SkeletonImage` for any real photo/remote image.

❌ **Don't** add a skeleton to a purely synchronous component — it renders
instantly, so a skeleton would just be a fake delay.
❌ **Don't** add fake `setTimeout` delays just to show a skeleton.
❌ **Don't** forget `position: relative` on a new `SkeletonImage` wrapper.
