import { useEffect, useState } from 'react'
import { isFirebaseConfigured } from '../firebase'
import {
  subscribeAllEvents,
  subscribeSession,
  subscribeSessionEvents,
  subscribeSessions,
  subscribeSubjects,
} from './store'

// Generic live-subscription hook. `subscribe(callback, onError)` returns an unsubscribe function.
function useLive(subscribe, deps, initial) {
  const [state, setState] = useState({ data: initial, loading: true, error: null })

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ data: initial, loading: false, error: null })
      return undefined
    }
    setState((current) => ({ ...current, loading: true }))
    return subscribe(
      (data) => setState({ data, loading: false, error: null }),
      (error) => setState((current) => ({ ...current, loading: false, error })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

const EMPTY = []

export const useSubjects = () => useLive(subscribeSubjects, [], EMPTY)
export const useSessions = () => useLive(subscribeSessions, [], EMPTY)
export const useAllEvents = () => useLive(subscribeAllEvents, [], EMPTY)
export const useSessionEvents = (sessionId) =>
  useLive((cb, err) => subscribeSessionEvents(sessionId, cb, err), [sessionId], EMPTY)
export const useSession = (sessionId) =>
  useLive((cb, err) => subscribeSession(sessionId, cb, err), [sessionId], null)

export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
