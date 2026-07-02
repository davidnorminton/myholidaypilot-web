import { CalendarRange } from 'lucide-react'
import { useAuth, GoogleSignInButton } from '../lib/auth.jsx'
import PlannerGuide from './PlannerGuide.jsx'
import PlannerFeatures from './PlannerFeatures.jsx'

// The trip planner is an account feature: shown in place of planner screens
// when signed out.
export default function PlanGate() {
  const { configured, isDev, devSignIn } = useAuth()
  return (
    <div className="plangate">
      <CalendarRange size={30} />
      <h2 className="plangate__title">Sign in to plan your trip</h2>
      <p className="plangate__sub">
        The trip planner is free with a Google sign-in — your trips are saved to your
        account and follow you across devices.
      </p>
      <div className="plangate__cta">
        {configured
          ? <GoogleSignInButton />
          : isDev
            ? <button className="btn btn--primary" onClick={devSignIn}>Continue in dev mode</button>
            : <p className="plangate__sub">Sign-in isn’t configured yet.</p>}
      </div>
      <PlannerFeatures />
      <PlannerGuide title="How it works" />
    </div>
  )
}
