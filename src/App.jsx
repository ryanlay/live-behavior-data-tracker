import { useState } from 'react'
import { useAuth } from './auth/AuthContext'
import Admin from './components/Admin'
import Collect from './components/Collect'
import Login from './components/Login'
import Review from './components/Review'
import { isFirebaseConfigured } from './firebase'

export default function App() {
  const { user, isAdmin, signOut } = useAuth()
  const [view, setView] = useState('collect')

  if (!user) return <Login />

  const tabs = [
    { id: 'collect', label: 'Collect data' },
    { id: 'review', label: 'Review' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ]
  const activeView = tabs.some((tab) => tab.id === view) ? view : 'collect'

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Live Behavior Data Tracker</h1>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeView === tab.id ? 'nav-item selected' : 'nav-item'}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="user-box">
          <span>{user.name} <span className="pill">{isAdmin ? 'Admin' : 'User'}</span></span>
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {!isFirebaseConfigured && (
        <div className="card error-card">
          <strong>Firebase is not configured.</strong> Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
          Firebase web app values, and restart the dev server. See the README.
        </div>
      )}

      <main>
        {/* Collect stays mounted so an in-progress session survives switching tabs. */}
        <div hidden={activeView !== 'collect'}><Collect user={user} /></div>
        {activeView === 'review' && <Review />}
        {activeView === 'admin' && isAdmin && <Admin />}
      </main>
    </div>
  )
}
