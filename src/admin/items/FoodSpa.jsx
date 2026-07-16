import '../css/FoodSpa.css'
import {useState} from 'react'


const service = [
    {id: 'all', label: 'All'},
    {id: 'food',label: 'Food'},
    {id: 'spa', label: 'Spa'}
]

export default function FoodSpa({active,onChange}){
    const[internalActive,setInternalActive] = useState('all')
    const current = active ?? internalActive

    const handleSelect =(id)=>{
        setInternalActive(id)
        if(onChange) onChange(id)
    }

    
    return(
        <>
        <div className ="food-and-spa-tab" role="tablist" aria-label="Filter services">
            {service.map(({id, label}) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={current === id}
                    className={current === id ? 'tab-item active' : 'tab-item'}
                    onClick={() => handleSelect(id)}
                >
                    {label}
                </button>
            ))}

        </div>

        
        </>
    )

}