// Saves one booking as a PNG the guest can keep in their photos and show at
// the gate — no print dialog, no PDF viewer, nothing to open.
//
// The sheet is drawn on a canvas rather than rasterised from DOM. Turning
// markup into an image needs either a library (html2canvas, ~200 kB) or an
// <svg><foreignObject> round-trip, and the latter still renders blank on some
// Safari versions. A guest whose receipt saves as a white rectangle has no way
// to tell and no way to recover, so the drawing is done by hand instead: it is
// the same on every browser and needs nothing that isn't already here.

import { splitFreeEntrance } from '../../data/entranceFee.js'

// Layout is authored at this width and drawn at SCALE, so the file stays crisp
// when it is opened full-screen on a phone or zoomed into at the gate.
const WIDTH = 900
const PAD = 48
const SCALE = 2

const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif'

// Same palette as the rest of the site.
const INK = '#1A1A14'
const FOREST = '#1E3A2B'
const LEAF = '#4C6B4F'
const GOLD = '#8A6D2F'
const MUTED = '#5A6455'
const CREDIT = '#2E7D46'
const RULE = '#C9C2AC'
const PAPER = '#FFFFFF'

// ------------------------------------------------------------------ content

function formatLongDate(value){
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
}

function formatClock(ms){
    if (ms == null) return null
    return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Two decimals: this is the document a guest settles up against at the gate,
// so the centavos are spelled out rather than rounded away.
function formatPeso(amount){
    return `₱${Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

function stayLength(booking){
    if (booking.sameDayCheckout) return '1 day use'
    if (!booking.checkIn || !booking.checkOut) return null
    const nights = Math.max(1, Math.round(
        (new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000
    ))
    return `${nights} night${nights > 1 ? 's' : ''}`
}

function scheduleLabel(booking){
    const schedule = booking.schedule
    if (!schedule) return 'Schedule not on file'
    // `checkIn` carries the schedule's name with its separator ('Day Time: ').
    const name = schedule.checkIn?.replace(/[:\s]+$/, '') ?? 'Stay'
    return `${name} — ${schedule.time}${schedule.description ? ` (${schedule.description})` : ''}`
}

function orderTotal(orders){
    return (orders ?? []).reduce((sum, order) => sum + Number(order.total ?? 0), 0)
}

// Everything the sheet says, worked out once. Nothing here is fetched: the
// booking row is already in hand, so saving works offline and cannot reach
// another guest's reservation.
function buildReceipt(booking, statusLabel, savedAt){
    const rate = booking.price != null ? Number(booking.price) : null
    const entrance = Number(booking.entrance?.total ?? 0)
    const foodOrders = booking.foodOrders ?? []
    const spaOrders = booking.spaOrders ?? []
    const addOns = orderTotal(foodOrders) + orderTotal(spaOrders)

    // Everything this stay costs. The down payment is half of it — unit rate,
    // entrance fees and add-ons alike — and the rest is settled on arrival.
    const stayTotal = Number(
        booking.stayTotal ?? (rate ?? 0) + entrance + addOns,
    )
    const downPayment = Number(booking.downpayment ?? stayTotal * 0.5)

    // What the resort has actually been sent proof of, not what was asked for.
    // 'unpaid' means no receipt ever landed, so nothing is credited.
    const paid = booking.payment === 'paid-full'
        ? stayTotal
        : Number(booking.paidSubmitted ?? 0)
    const dueOnArrival = Math.max(0, stayTotal - paid)

    const guests = [
        booking.pax ? `${booking.pax} pax` : null,
        booking.kids > 0 ? `${booking.kids} kid${booking.kids > 1 ? 's' : ''}` : null,
        booking.seniors > 0 ? `${booking.seniors} senior${booking.seniors > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' • ') || 'Not provided'

    const checkInTime = formatClock(booking.startsAt)
    const checkOutTime = formatClock(booking.endsAt)
    const length = stayLength(booking)

    // Every line the stay is made of, then what has been paid against it. The
    // order matters: a guest reading this at the gate should be able to follow
    // it top to bottom and arrive at the figure they are being asked for.
    const charges = [
        {
            label: 'Accommodation rate',
            sub: booking.accomodationName,
            value: rate != null ? formatPeso(rate) : 'To be advised',
        },
    ]
    if (entrance > 0){
        // Free entrance is kids 7 & below plus the rate card's 2-pax perk —
        // see entranceFee.js for how the combined bucket splits back out.
        const { kidsApplied, kidsFree, perkApplied, perkSavings } = splitFreeEntrance({
            freeApplied: booking.entrance.freeApplied,
            freeSavings: booking.entrance.freeSavings,
            kids: booking.kids,
            perHead: booking.entrance.perHead,
        })
        charges.push({
            label: 'Entrance fee',
            sub: [
                `${formatPeso(booking.entrance.perHead)}/head`,
                kidsApplied > 0
                    ? `free entrance ${kidsApplied} pax (kids 7 & below)`
                        + ` − ${formatPeso(kidsFree)}`
                    : null,
                perkApplied > 0
                    ? `free entrance ${perkApplied} pax (resort inclusion)`
                        + ` − ${formatPeso(perkSavings)}`
                    : null,
                booking.entrance.seniorDiscount > 0
                    ? `senior discount − ${formatPeso(booking.entrance.seniorDiscount)}`
                    : null,
            ].filter(Boolean).join(' • '),
            value: formatPeso(entrance),
        })
    }
    for (const order of foodOrders){
        charges.push({
            label: `Food — ${order.name}`,
            sub: order.quantity ? `x${order.quantity}` : null,
            value: formatPeso(order.total),
        })
    }
    for (const order of spaOrders){
        charges.push({
            label: `Spa — ${order.name}`,
            sub: order.quantity ? `x${order.quantity}` : null,
            value: formatPeso(order.total),
        })
    }
    charges.push({
        label: 'Stay subtotal',
        value: formatPeso(stayTotal),
    })
    charges.push({
        label: 'Down payment (50%)',
        sub: 'unit rate, entrance fees and any add-ons',
        value: formatPeso(downPayment),
    })
    if (paid > 0){
        charges.push({
            label: booking.payment === 'paid-full' ? 'Paid in full' : 'Payment received',
            sub: booking.payment === 'paid-full' ? null : 'proof of payment on file',
            value: `− ${formatPeso(paid)}`,
            tone: 'credit',
        })
    }

    const notes = [
        'Present this receipt at check-in. The remaining balance above is settled'
            + ' on-site. Seniors must show a valid ID for the discount to apply.',
    ]
    if (paid > 0 && paid < downPayment){
        notes.push(
            `Your down payment is short by ${formatPeso(downPayment - paid)} —`
                + ' add-ons ordered after paying raised the total. Settle the'
                + ' difference from My Bookings.',
        )
    }
    if (statusLabel === 'For Verification'){
        notes.push(
            'Your reservation is held pending our review of the down-payment receipt.'
                + ' We confirm by email or SMS once it is verified.',
        )
    }

    return {
        code: booking.code ?? booking.id,
        statusLabel,
        unitId: booking.unitId,
        sections: [
            {
                title: 'Stay',
                rows: [
                    { label: 'Accommodation', value: booking.accomodationName },
                    { label: 'Schedule', value: scheduleLabel(booking) },
                    {
                        label: 'Check-in',
                        sub: checkInTime ? `from ${checkInTime}` : null,
                        value: formatLongDate(booking.checkIn),
                    },
                    {
                        label: 'Check-out',
                        sub: checkOutTime ? `until ${checkOutTime}` : null,
                        value: formatLongDate(booking.checkOut),
                    },
                    length ? { label: 'Length of stay', value: length } : null,
                ].filter(Boolean),
            },
            {
                title: 'Guest',
                rows: [
                    { label: 'Name', value: booking.guest?.fullName || 'Not provided' },
                    { label: 'Mobile', value: booking.guest?.mobile || 'Not provided' },
                    { label: 'Email', value: booking.guest?.email || 'Not provided' },
                    { label: 'Guests', value: guests },
                ],
            },
            { title: 'Charges', rows: charges },
        ],
        total: formatPeso(dueOnArrival),
        // A guest who has not paid online yet would otherwise read the figure
        // above as the whole story. Name what is still owed on the down payment
        // so the sheet cannot be mistaken for a settled account.
        totalNote: [
            rate == null ? 'Plus the accommodation balance, which is still to be advised.' : null,
            paid < downPayment
                ? `Down payment still outstanding: ${formatPeso(downPayment - paid)}.`
                : null,
        ].filter(Boolean).join(' ') || null,
        notes,
        footer: [
            booking.createdAt ? `Booked ${formatLongDate(booking.createdAt)}` : null,
            `Saved ${formatLongDate(savedAt)}`,
        ].filter(Boolean).join(' • '),
    }
}

// ------------------------------------------------------------------ drawing

function wrap(ctx, text, maxWidth){
    const words = String(text).split(' ')
    const lines = []
    let current = ''
    for (const word of words){
        const candidate = current ? `${current} ${word}` : word
        if (current && ctx.measureText(candidate).width > maxWidth){
            lines.push(current)
            current = word
        } else {
            current = candidate
        }
    }
    if (current) lines.push(current)
    return lines
}

function rule(ctx, y, { dotted = false, weight = 1, color = RULE } = {}){
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = weight
    ctx.setLineDash(dotted ? [2, 3] : [])
    ctx.beginPath()
    // Half-pixel offset keeps a 1px rule from landing across two rows of pixels.
    ctx.moveTo(PAD, y + 0.5)
    ctx.lineTo(WIDTH - PAD, y + 0.5)
    ctx.stroke()
    ctx.restore()
}

function drawRow(ctx, y, row){
    const labelFont = `17px ${SERIF}`
    const valueFont = `bold 17px ${SERIF}`

    ctx.font = labelFont
    const labelWidth = ctx.measureText(row.label).width

    // The value gets whatever the label leaves, and wraps into it rather than
    // running off the sheet — schedule lines in particular are long.
    ctx.font = valueFont
    const available = WIDTH - PAD * 2 - labelWidth - 24
    const valueLines = ctx.measureText(row.value).width > available
        ? wrap(ctx, row.value, available)
        : [row.value]

    ctx.textAlign = 'left'
    ctx.font = labelFont
    ctx.fillStyle = INK
    ctx.fillText(row.label, PAD, y)

    ctx.textAlign = 'right'
    ctx.font = valueFont
    ctx.fillStyle = row.tone === 'credit' ? CREDIT : INK
    valueLines.forEach((text, index) => {
        ctx.fillText(text, WIDTH - PAD, y + index * 22)
    })

    let bottom = y + (valueLines.length - 1) * 22

    if (row.sub){
        ctx.textAlign = 'left'
        ctx.font = `13px ${SERIF}`
        ctx.fillStyle = MUTED
        const subLines = wrap(ctx, row.sub, WIDTH - PAD * 2)
        subLines.forEach((text, index) => {
            ctx.fillText(text, PAD, y + 18 + index * 16)
        })
        bottom = Math.max(bottom, y + 18 + (subLines.length - 1) * 16)
    }

    rule(ctx, bottom + 10, { dotted: true })
    return bottom + 10 + 22
}

// Draws the whole sheet and returns the height it needed, so the first pass
// can size the real canvas before the second pass paints it for keeps.
function paint(ctx, model){
    let y = PAD + 20

    ctx.textAlign = 'left'
    ctx.letterSpacing = '3px'
    ctx.font = `bold 13px ${SERIF}`
    ctx.fillStyle = GOLD
    ctx.fillText('CAMP BA-LONG', PAD, y)
    ctx.letterSpacing = '0px'

    ctx.font = `bold 40px ${SERIF}`
    ctx.fillStyle = FOREST
    ctx.fillText('Booking Receipt', PAD, y + 42)

    ctx.textAlign = 'right'
    ctx.font = `bold 22px ${SERIF}`
    ctx.fillStyle = FOREST
    ctx.fillText(model.code, WIDTH - PAD, y + 2)

    ctx.font = `15px ${SERIF}`
    ctx.fillStyle = MUTED
    ctx.fillText(model.statusLabel, WIDTH - PAD, y + 26)
    if (model.unitId){
        ctx.fillText(`Unit ${model.unitId}`, WIDTH - PAD, y + 48)
    }

    y += 70
    rule(ctx, y, { weight: 2, color: FOREST })
    y += 36

    for (const section of model.sections){
        ctx.textAlign = 'left'
        ctx.letterSpacing = '2px'
        ctx.font = `bold 12px ${SERIF}`
        ctx.fillStyle = LEAF
        ctx.fillText(section.title.toUpperCase(), PAD, y)
        ctx.letterSpacing = '0px'
        y += 24

        for (const row of section.rows) y = drawRow(ctx, y, row)
        y += 14
    }

    y += 4
    rule(ctx, y, { weight: 2, color: FOREST })
    y += 34

    ctx.textAlign = 'left'
    ctx.letterSpacing = '1.5px'
    ctx.font = `bold 16px ${SERIF}`
    ctx.fillStyle = FOREST
    ctx.fillText('DUE ON ARRIVAL', PAD, y)
    ctx.letterSpacing = '0px'

    ctx.textAlign = 'right'
    ctx.font = `bold 30px ${SERIF}`
    ctx.fillText(model.total, WIDTH - PAD, y + 4)

    y += 22
    rule(ctx, y, { weight: 2, color: FOREST })
    y += 30

    ctx.textAlign = 'left'
    if (model.totalNote){
        ctx.font = `14px ${SERIF}`
        ctx.fillStyle = MUTED
        ctx.fillText(model.totalNote, PAD, y)
        y += 24
    }

    ctx.font = `15px ${SERIF}`
    ctx.fillStyle = MUTED
    for (const note of model.notes){
        for (const line of wrap(ctx, note, WIDTH - PAD * 2)){
            ctx.fillText(line, PAD, y)
            y += 21
        }
        y += 8
    }

    y += 6
    rule(ctx, y)
    y += 24
    ctx.font = `13px ${SERIF}`
    ctx.fillStyle = LEAF
    ctx.fillText(model.footer, PAD, y)

    return y + PAD
}

function render(model){
    // First pass measures. Text wrapping needs a real context, so the sheet is
    // simply drawn onto a throwaway canvas to find out how tall it came out.
    const scratch = document.createElement('canvas')
    scratch.width = WIDTH
    scratch.height = 4000
    const height = paint(scratch.getContext('2d'), model)

    const canvas = document.createElement('canvas')
    canvas.width = WIDTH * SCALE
    canvas.height = Math.ceil(height) * SCALE
    const ctx = canvas.getContext('2d')
    ctx.scale(SCALE, SCALE)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, WIDTH, height)
    paint(ctx, model)
    return canvas
}

function toBlob(canvas){
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// ------------------------------------------------------------------- saving

export async function saveReceiptImage(booking, statusLabel){
    if (!booking) return { ok: false, message: 'There is no booking to save.' }

    try {
        const model = buildReceipt(booking, statusLabel, Date.now())
        const blob = await toBlob(render(model))
        if (!blob) throw new Error('the image could not be encoded')

        const filename = `Camp-Balong-Receipt-${model.code}.png`
        const url = URL.createObjectURL(blob)

        // Older iOS Safari ignores the download attribute and navigates to the
        // blob instead, which loses the page. Open it in its own tab there —
        // the guest saves it from the image with a long press.
        const link = document.createElement('a')
        if ('download' in link){
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
        } else {
            window.open(url, '_blank', 'noopener')
        }

        // Give the browser the tick it needs to start reading the blob.
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return { ok: true }
    } catch (error) {
        console.error('Could not save the receipt image:', error)
        return {
            ok: false,
            message: 'Could not save your receipt image. Please try again, or'
                + ' screenshot this page — your booking is safe either way.',
        }
    }
}
