import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import LandingScreen from './screens/LandingScreen.jsx'
import CountriesScreen from './screens/CountriesScreen.jsx'
import ItalyHubScreen from './screens/ItalyHubScreen.jsx'
import RegionsScreen from './screens/RegionsScreen.jsx'
import GuideScreen from './screens/GuideScreen.jsx'
import RegionDetailScreen from './screens/RegionDetailScreen.jsx'
import PlaceDetailScreen from './screens/PlaceDetailScreen.jsx'
import PlanScreen from './screens/PlanScreen.jsx'
import BlogScreen from './screens/BlogScreen.jsx'
import BlogPostScreen from './screens/BlogPostScreen.jsx'
import AppScreen from './screens/AppScreen.jsx'
import AdminScreen from './screens/AdminScreen.jsx'
import SavedScreen from './screens/SavedScreen.jsx'
import TripsScreen from './screens/TripsScreen.jsx'
import SharedTripScreen from './screens/SharedTripScreen.jsx'
import AccountScreen from './screens/AccountScreen.jsx'
import GuidedPlannerScreen from './screens/GuidedPlannerScreen.jsx'
import { GalleryScreen, GalleryTripScreen } from './screens/GalleryScreens.jsx'
import DayTripsScreen from './screens/DayTripsScreen.jsx'
import PlanGate from './components/PlanGate.jsx'
import { useAuth } from './lib/auth.jsx'

function RequireAuth({ children }) {
  // `user` restores synchronously from localStorage, so there's no loading
  // state to wait for (`ready` tracks the Google SDK script, not auth).
  const { user } = useAuth()
  if (!user) return <div className="page wrap"><PlanGate /></div>
  return children
}
import NotFoundScreen from './screens/NotFoundScreen.jsx'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/destinations" element={<CountriesScreen />} />
          <Route path="/:country" element={<ItalyHubScreen />} />
          <Route path="/:country/regions" element={<RegionsScreen />} />
          <Route path="/:country/festivals" element={<GuideScreen topic="festivals" />} />
          <Route path="/:country/history" element={<GuideScreen topic="history" />} />
          <Route path="/:country/food" element={<GuideScreen topic="food" />} />
          <Route path="/:country/transport" element={<GuideScreen topic="transport" />} />
          <Route path="/:country/:regionId" element={<RegionDetailScreen />} />
          <Route path="/:country/:regionId/:placeId" element={<PlaceDetailScreen />} />
          <Route path="/saved" element={<SavedScreen />} />
          <Route path="/trips" element={<RequireAuth><TripsScreen /></RequireAuth>} />
          <Route path="/guided" element={<GuidedPlannerScreen />} />
          <Route path="/gallery" element={<GalleryScreen />} />
          <Route path="/gallery/:slug" element={<GalleryTripScreen />} />
          <Route path="/day-trips" element={<DayTripsScreen />} />
          <Route path="/account" element={<RequireAuth><AccountScreen /></RequireAuth>} />
          <Route path="/account/:section" element={<RequireAuth><AccountScreen /></RequireAuth>} />
          <Route path="/trip/:code" element={<SharedTripScreen />} />
          <Route path="/plan" element={<RequireAuth><PlanScreen /></RequireAuth>} />
          <Route path="/blog" element={<BlogScreen />} />
          <Route path="/blog/:slug" element={<BlogPostScreen />} />
          <Route path="/app" element={<AppScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </>
  )
}
