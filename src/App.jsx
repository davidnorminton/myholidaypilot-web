import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
// Eager: the content pages that are the common entry points / first paint.
import TripPlannerScreen from './screens/TripPlannerScreen.jsx'
import LandingScreen from './screens/LandingScreen.jsx'
import CountriesScreen from './screens/CountriesScreen.jsx'
import ItalyHubScreen from './screens/ItalyHubScreen.jsx'
import RegionsScreen from './screens/RegionsScreen.jsx'
import GuideScreen from './screens/GuideScreen.jsx'
import RegionDetailScreen from './screens/RegionDetailScreen.jsx'
import PlaceDetailScreen from './screens/PlaceDetailScreen.jsx'
// Lazy: heavier / secondary screens — split into their own chunks so a visitor
// landing on a content page doesn't download the planner, admin, gallery, etc.
const PlanScreen = lazy(() => import('./screens/PlanScreen.jsx'))
const BlogScreen = lazy(() => import('./screens/BlogScreen.jsx'))
const ContactScreen = lazy(() => import('./screens/ContactScreen.jsx'))
const BlogPostScreen = lazy(() => import('./screens/BlogPostScreen.jsx'))
const AppScreen = lazy(() => import('./screens/AppScreen.jsx'))
const AdminScreen = lazy(() => import('./screens/AdminScreen.jsx'))
const SavedScreen = lazy(() => import('./screens/SavedScreen.jsx'))
const TripsScreen = lazy(() => import('./screens/TripsScreen.jsx'))
const SharedTripScreen = lazy(() => import('./screens/SharedTripScreen.jsx'))
const AccountScreen = lazy(() => import('./screens/AccountScreen.jsx'))
const GuidedPlannerScreen = lazy(() => import('./screens/GuidedPlannerScreen.jsx'))
const GalleryScreen = lazy(() => import('./screens/GalleryScreens.jsx').then((m) => ({ default: m.GalleryScreen })))
const GalleryTripScreen = lazy(() => import('./screens/GalleryScreens.jsx').then((m) => ({ default: m.GalleryTripScreen })))
const DayTripsScreen = lazy(() => import('./screens/DayTripsScreen.jsx'))
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
      <Suspense fallback={<div className="page wrap" style={{ minHeight: '60vh' }} />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/trip-planner" element={<TripPlannerScreen />} />
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
          <Route path="/trip-ideas" element={<GalleryScreen />} />
          <Route path="/trip-ideas/:slug" element={<GalleryTripScreen />} />
          {/* old URLs redirect */}
          <Route path="/gallery" element={<Navigate to="/trip-ideas" replace />} />
          <Route path="/gallery/:slug" element={<GalleryRedirect />} />
          <Route path="/day-trips" element={<DayTripsScreen />} />
          <Route path="/account" element={<RequireAuth><AccountScreen /></RequireAuth>} />
          <Route path="/account/:section" element={<RequireAuth><AccountScreen /></RequireAuth>} />
          <Route path="/trip/:code" element={<SharedTripScreen />} />
          <Route path="/plan" element={<RequireAuth><PlanScreen /></RequireAuth>} />
          <Route path="/blog" element={<BlogScreen />} />
          <Route path="/contact" element={<ContactScreen />} />
          <Route path="/blog/:slug" element={<BlogPostScreen />} />
          <Route path="/app" element={<AppScreen />} />
          <Route path="/admin" element={<AdminScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  )
}

// Old /gallery/:slug URLs → /trip-ideas/:slug
function GalleryRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/trip-ideas/${slug}`} replace />
}
