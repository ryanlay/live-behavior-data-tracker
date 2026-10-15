import {
  collection,
  collectionGroup,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'

// Writes are intentionally NOT awaited by the UI: with offline persistence a
// write promise only resolves once the server acknowledges it, but the local
// cache (and live listeners) update immediately.
function fire(promise) {
  promise.catch((error) => console.error('Firestore write failed:', error))
}

function listen(query, mapper, callback, onError) {
  return onSnapshot(
    query,
    (snapshot) => callback(snapshot.docs.map((entry) => mapper(entry))),
    (error) => onError?.(error),
  )
}

const withId = (entry) => ({ ...entry.data(), id: entry.id })

// ---- Subjects -------------------------------------------------------------

export function subscribeSubjects(callback, onError) {
  return listen(collection(db, 'subjects'), (entry) => ({ ...entry.data(), code: entry.id }), callback, onError)
}

export function createSubject(code) {
  const now = Date.now()
  fire(setDoc(doc(db, 'subjects', code), { isActive: true, targets: [], createdAt: now, updatedAt: now }))
}

export function saveSubjectFields(code, fields) {
  fire(setDoc(doc(db, 'subjects', code), { ...fields, updatedAt: Date.now() }, { merge: true }))
}

// ---- Sessions -------------------------------------------------------------

export function subscribeSessions(callback, onError) {
  return listen(collection(db, 'sessions'), withId, callback, onError)
}

export function subscribeSession(sessionId, callback, onError) {
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snapshot) => callback(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null),
    (error) => onError?.(error),
  )
}

export function startSession(subject, user) {
  const ref = doc(collection(db, 'sessions'))
  fire(
    setDoc(ref, {
      subjectCode: subject.code,
      observerName: user.name,
      observerRole: user.role,
      startedAt: Date.now(),
      endedAt: null,
      notes: '',
      // Snapshot of the setup so review still makes sense if Admin edits it later.
      targets: subject.targets || [],
    }),
  )
  return ref.id
}

export function endSession(sessionId, notes) {
  fire(updateDoc(doc(db, 'sessions', sessionId), { endedAt: Date.now(), notes: notes || '' }))
}

export function updateSessionNotes(sessionId, notes) {
  fire(updateDoc(doc(db, 'sessions', sessionId), { notes }))
}

export async function deleteSession(sessionId) {
  const events = await getDocs(collection(db, 'sessions', sessionId, 'events'))
  const batch = writeBatch(db)
  events.forEach((entry) => batch.delete(entry.ref))
  batch.delete(doc(db, 'sessions', sessionId))
  await batch.commit()
}

// ---- Events ---------------------------------------------------------------

export function subscribeSessionEvents(sessionId, callback, onError) {
  return listen(collection(db, 'sessions', sessionId, 'events'), withId, callback, onError)
}

export function subscribeAllEvents(callback, onError) {
  return listen(collectionGroup(db, 'events'), withId, callback, onError)
}

// kind: 'episode' | 'count' | 'intensity' | 'interval' | 'attempt' | 'success'
export function addEvent(session, behavior, kind, payload = {}) {
  const ref = doc(collection(db, 'sessions', session.id, 'events'))
  const now = Date.now()
  fire(
    setDoc(ref, {
      sessionId: session.id,
      subjectCode: session.subjectCode,
      observerName: session.observerName,
      behavior,
      kind,
      ts: now,
      ...payload,
      createdMs: now,
    }),
  )
  return ref.id
}

export function deleteEvent(sessionId, eventId) {
  fire(deleteDoc(doc(db, 'sessions', sessionId, 'events', eventId)))
}
