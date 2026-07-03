import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import { useAuth } from '../lib/auth.jsx'
import { syncFavourites, clearFavourites } from '../lib/favourites.js'
import { syncTrips } from '../lib/trips.js'
import { syncVisits, clearVisits } from '../lib/visits.js'

export default function Layout() {
  const { user } = useAuth()
  useEffect(() => {
    if (user) { syncFavourites(); syncTrips(user); syncVisits() }
    else { clearFavourites(); syncTrips(null); clearVisits() }
  }, [user])

  return (
    <>
      <TopBar />
      <Outlet />
      <Footer />
    </>
  )
}
