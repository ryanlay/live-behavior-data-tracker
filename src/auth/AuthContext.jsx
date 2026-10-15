import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// Demo authentication for scaffolding / dummy-data testing only.
//
// The rest of the app depends ONLY on this context's shape:
//   { user: { name, role: 'admin' | 'user' } | null, isAdmin, signIn(name, role), signOut() }
//
// TODO: replace with Firebase Auth (Microsoft SSO restricted to *@tcfd.org) and
// derive `role` from an Admin-managed roster instead of letting the user choose it.

const STORAGE_KEY = 'lbt:demoUser'
const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (parsed?.name && (parsed.role === 'admin' || parsed.role === 'user')) return parsed
  } catch {
    // ignore malformed storage
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)

  const signIn = useCallback((name, role) => {
    const next = { name: name.trim(), role: role === 'admin' ? 'admin' : 'user' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setUser(next)
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, isAdmin: user?.role === 'admin', signIn, signOut }), [user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
