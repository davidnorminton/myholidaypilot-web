import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.jsx'
import Footer from './Footer.jsx'
import { useAuth } from '../lib/auth.jsx'
import { syncFavourites, clearFavourites } from '../lib/favourites.js'

export default function Layout() {
  const { user } = useAuth()
  useEffect(() => { if (user) syncFavourites(); else clearFavourites() }, [user])

  return (
    <>
      <TopBar />
      <Outlet />
      <Footer />
    </>
  )
}
