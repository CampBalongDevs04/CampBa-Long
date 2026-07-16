import { useEffect, useState } from 'react'
import './clockDate.css'

function getLocationLabel(timeZone) {
    const city = timeZone.split('/').pop().replace(/_/g, ' ')
    return city
}

export default function ClockDate({ timeZone }) {
    const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const tick = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(tick)
    }, [])

    const time = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(now)

    const date = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(now)

    return (
        <div className="clock-date">
            <span className="clock-date-time">{time}</span>
            <span className="clock-date-day">{date}</span>
            <span className="clock-date-location">{getLocationLabel(zone)}</span>
        </div>
    )
}
