import {useState} from 'react'
import '../css/'

const TabSpaService = [
    {id: 'avail', label: 'Avail'}
]

 

export default function SpaService({active, onChange}){
    const [internalActive, setInternalActive] = useState('avail')
    const current = active ?? internalActive

    const handleSelect =(id) => {
        setInternalActive(id)
        if (onChange) onChange(id)
    }

    return(
        <>
            <div className ="Spa-Tab" role="tablist">
                {TabSpaService.map(({id, label}) => (  
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-slected={current === id}
                        className={current ===id ? 'Spa-Tab-item active' : 'Spa-Tab-item'}
                        onClick={() => handleSelect(id)}
                        >
                            {label}
                        </button>
                ))}
            </div>
        </>
    )
}