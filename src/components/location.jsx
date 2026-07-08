import './css/location.css'
import LotusDividerIcon from './LotusDividerIcon'

const locationInfo = [
    {
        nation: 'Philippines',
        city: 'Liliw, Laguna',
        address: 'Brgy. Ibabang Sungi',
        Description: ''
    }
]




export default function Location(){
    return(
        <>
            <section className = "location-section">
                

                <div className = "location-header">    
                    <LotusDividerIcon />
                    <h1 className = "location-title">Location</h1>
                </div>    
                
            </section>
            
        </>
    )
}