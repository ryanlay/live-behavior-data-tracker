import { useEffect, useState } from 'react'
import {
  INTERVAL_METRICS,
  INTERVAL_QUESTIONS,
  formatIntervalLength,
  intensityLabel,
  metricInfo,
} from '../constants/metrics'
import { useNow, useSession, useSessionEvents, useSubjects } from '../data/hooks'
import { addEvent, deleteEvent, endSession, startSession } from '../data/store'
import { fmtClock } from '../utils'

const ACTIVE_SESSION_KEY = 'lbt:activeSession'

export default function Collect({ user }) {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(ACTIVE_SESSION_KEY))

  function begin(subject) {
    const id = startSession(subject, user)
    localStorage.setItem(ACTIVE_SESSION_KEY, id)
    setSessionId(id)
  }

  function leave() {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
    setSessionId(null)
  }

  return sessionId ? <LiveSession key={sessionId} sessionId={sessionId} onLeave={leave} /> : <SubjectPicker onPick={begin} />
}

function SubjectPicker({ onPick }) {
  const { data: subjects, loading, error } = useSubjects()
  const active = subjects
    .filter((subject) => subject.isActive !== false)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  return (
    <section className="card">
      <h2>Choose a subject</h2>
      <p className="muted">Pick who you are taking data on to start a session.</p>
      {error && <p className="error">Could not load subjects: {error.message}</p>}
      {loading && <p className="muted">Loading&hellip;</p>}
      {!loading && active.length === 0 && <p className="muted">No active subjects. An Admin needs to add one first.</p>}
      <div className="subject-grid">
        {active.map((subject) => {
          const ready = (subject.targets || []).some((target) => target.metrics?.length)
          return (
            <button
              key={subject.code}
              type="button"
              className="subject-tile"
              disabled={!ready}
              onClick={() => onPick(subject)}
            >
              <strong>{subject.code}</strong>
              <small>
                {ready ? (subject.targets || []).map((target) => target.behavior).join(', ') : 'No behaviors set up yet'}
              </small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function LiveSession({ sessionId, onLeave }) {
  const { data: session, loading } = useSession(sessionId)
  const { data: events } = useSessionEvents(sessionId)
  const now = useNow(250)
  const [ending, setEnding] = useState(false)
  const [notes, setNotes] = useState('')
  const online = useOnline()

  // Session was deleted or already ended elsewhere: drop back to the picker.
  useEffect(() => {
    if (!loading && (!session || session.endedAt)) onLeave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session])

  if (!session) return <section className="card"><p className="muted">Loading session&hellip;</p></section>

  const lastEvent = events.reduce((latest, event) => (!latest || event.createdMs > latest.createdMs ? event : latest), null)

  function finish() {
    clearRunningTimers(sessionId)
    endSession(sessionId, notes)
    onLeave()
  }

  return (
    <div className="stack">
      <section className="card session-bar">
        <div>
          <h2>{session.subjectCode}</h2>
          <p className="muted">
            Observer: {session.observerName} &middot; Elapsed <strong className="mono">{fmtClock(now - session.startedAt)}</strong>
          </p>
        </div>
        <div className="session-actions">
          <span className={`pill ${online ? 'ok' : 'warn'}`}>{online ? 'Online' : 'Offline \u2013 saving locally'}</span>
          <button type="button" onClick={() => lastEvent && deleteEvent(sessionId, lastEvent.id)} disabled={!lastEvent}>
            Undo last entry
          </button>
          <button type="button" className="danger" onClick={() => setEnding(true)}>End session</button>
        </div>
      </section>

      {ending && (
        <section className="card">
          <h3>End session for {session.subjectCode}?</h3>
          <label>
            Session notes (optional)
            <textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="button-row">
            <button type="button" onClick={() => setEnding(false)}>Keep recording</button>
            <button type="button" className="primary" onClick={finish}>End and save</button>
          </div>
        </section>
      )}

      {(session.targets || []).map((target) => (
        <BehaviorCard
          key={target.behavior}
          session={session}
          target={target}
          events={events.filter((event) => event.behavior === target.behavior)}
          now={now}
        />
      ))}
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

const runKey = (sessionId, behavior) => `lbt:run:${sessionId}:${behavior}`

function clearRunningTimers(sessionId) {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(`lbt:run:${sessionId}:`))
    .forEach((key) => localStorage.removeItem(key))
}

function BehaviorCard({ session, target, events, now }) {
  const metrics = target.metrics || []
  const has = (type) => metrics.some((metric) => metric.type === type)
  const intervalMetrics = metrics.filter((metric) => INTERVAL_METRICS.includes(metric.type))

  const episodes = events.filter((event) => event.kind === 'episode' || event.kind === 'count')
  const totalDuration = events.filter((event) => event.kind === 'episode').reduce((sum, event) => sum + (event.durationMs || 0), 0)

  return (
    <section className="card behavior-card">
      <div className="section-heading">
        <h3>{target.behavior}</h3>
        <p className="muted tally">
          {(has('frequency') || has('duration')) && <span>Episodes: <strong>{episodes.length}</strong></span>}
          {has('duration') && <span>Total: <strong className="mono">{fmtClock(totalDuration)}</strong></span>}
        </p>
      </div>

      {(has('frequency') || has('duration') || has('intensity')) && (
        <EpisodeControl session={session} behavior={target.behavior} metrics={metrics} now={now} />
      )}

      {intervalMetrics.map((metric) => (
        <IntervalControl key={metric.type} session={session} behavior={target.behavior} metric={metric} events={events} now={now} />
      ))}

      {(has('attempts') || has('successes')) && <TrialCounters session={session} behavior={target.behavior} metrics={metrics} events={events} />}
    </section>
  )
}

function IntensityButtons({ scaleMax, onPick, onSkip }) {
  return (
    <div className="rating">
      <p className="muted">Rate intensity:</p>
      <div className="button-row wrap">
        {Array.from({ length: scaleMax }, (_, index) => index + 1).map((value) => (
          <button key={value} type="button" className="rate-btn" onClick={() => onPick(value)}>
            {intensityLabel(value, scaleMax)}
          </button>
        ))}
        {onSkip && <button type="button" className="secondary" onClick={onSkip}>Skip</button>}
      </div>
    </div>
  )
}

function EpisodeControl({ session, behavior, metrics, now }) {
  const timed = metrics.some((metric) => metric.type === 'duration')
  const countOnly = !timed && metrics.some((metric) => metric.type === 'frequency')
  const intensity = metrics.find((metric) => metric.type === 'intensity')
  const key = runKey(session.id, behavior)

  const [startMs, setStartMs] = useState(() => Number(localStorage.getItem(key)) || null)
  const [pending, setPending] = useState(null) // episode/count payload awaiting an intensity rating

  function commit(kind, payload, rating) {
    addEvent(session, behavior, kind, { ...payload, intensity: rating ?? null, scaleMax: intensity?.scaleMax ?? null })
  }

  function start() {
    const stamp = Date.now()
    localStorage.setItem(key, String(stamp))
    setStartMs(stamp)
  }

  function stop() {
    const endMs = Date.now()
    localStorage.removeItem(key)
    setStartMs(null)
    const payload = { kind: 'episode', startMs, endMs, durationMs: endMs - startMs, ts: startMs }
    if (intensity) setPending(payload)
    else commit('episode', payload)
  }

  function tap() {
    const payload = { kind: 'count', ts: Date.now() }
    if (intensity) setPending(payload)
    else commit('count', payload)
  }

  function finishPending(rating) {
    const { kind, ...payload } = pending
    commit(kind, payload, rating)
    setPending(null)
  }

  if (pending) {
    return <IntensityButtons scaleMax={intensity.scaleMax} onPick={finishPending} onSkip={() => finishPending(null)} />
  }

  if (timed) {
    return startMs ? (
      <button type="button" className="big stop" onClick={stop}>
        <span>STOP</span>
        <span className="mono">{fmtClock(now - startMs)}</span>
      </button>
    ) : (
      <button type="button" className="big start" onClick={start}>START</button>
    )
  }

  if (countOnly) {
    return <button type="button" className="big start" onClick={tap}>+ Record episode</button>
  }

  // Intensity is the only episode-level metric: log a rating directly.
  return (
    <IntensityButtons
      scaleMax={intensity.scaleMax}
      onPick={(value) => addEvent(session, behavior, 'intensity', { value, scaleMax: intensity.scaleMax })}
    />
  )
}

function IntervalControl({ session, behavior, metric, events, now }) {
  const lengthMs = metric.intervalSeconds * 1000
  const elapsed = now - session.startedAt
  const completed = Math.floor(elapsed / lengthMs)

  const answered = new Set(
    events.filter((event) => event.kind === 'interval' && event.method === metric.type).map((event) => event.intervalIndex),
  )
  let pendingIndex = null
  let pendingCount = 0
  for (let index = 0; index < completed; index += 1) {
    if (!answered.has(index)) {
      pendingCount += 1
      if (pendingIndex === null) pendingIndex = index
    }
  }

  const yes = events.filter((event) => event.kind === 'interval' && event.method === metric.type && event.occurred).length
  const total = answered.size

  function answer(occurred) {
    addEvent(session, behavior, 'interval', {
      method: metric.type,
      occurred,
      intervalIndex: pendingIndex,
      intervalSeconds: metric.intervalSeconds,
      ts: session.startedAt + (pendingIndex + 1) * lengthMs,
    })
  }

  const remaining = lengthMs - (elapsed % lengthMs)
  const label = metricInfo(metric.type).label

  return (
    <div className={`interval ${pendingIndex !== null ? 'due' : ''}`}>
      <div className="interval-head">
        <strong>{label}</strong>
        <span className="muted">
          every {formatIntervalLength(metric.intervalSeconds)} &middot; next in <span className="mono">{fmtClock(remaining)}</span> &middot; {yes}/{total} yes
        </span>
      </div>
      <div className="progress"><div style={{ width: `${((lengthMs - remaining) / lengthMs) * 100}%` }} /></div>
      {pendingIndex !== null && (
        <div className="interval-prompt">
          <p>
            <strong>Interval {pendingIndex + 1} ended.</strong> {INTERVAL_QUESTIONS[metric.type]}
            {pendingCount > 1 && <span className="muted"> ({pendingCount - 1} more waiting)</span>}
          </p>
          <div className="button-row">
            <button type="button" className="big start" onClick={() => answer(true)}>Yes</button>
            <button type="button" className="big neutral" onClick={() => answer(false)}>No</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TrialCounters({ session, behavior, metrics, events }) {
  const attempts = events.filter((event) => event.kind === 'attempt').length
  const successes = events.filter((event) => event.kind === 'success').length
  const showAttempts = metrics.some((metric) => metric.type === 'attempts')
  const showSuccesses = metrics.some((metric) => metric.type === 'successes')

  return (
    <div className="trial-counters">
      {showAttempts && (
        <button type="button" className="big counter" onClick={() => addEvent(session, behavior, 'attempt')}>
          + Attempt <span className="count">{attempts}</span>
        </button>
      )}
      {showSuccesses && (
        <button type="button" className="big counter success" onClick={() => addEvent(session, behavior, 'success')}>
          + Success <span className="count">{successes}</span>
        </button>
      )}
      {showAttempts && showSuccesses && (
        <p className="muted">Success rate: <strong>{attempts ? `${Math.round((successes / attempts) * 100)}%` : '\u2014'}</strong></p>
      )}
    </div>
  )
}
