import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { metricInfo } from '../constants/metrics'
import { useAllEvents, useSessions } from '../data/hooks'
import { deleteEvent, deleteSession, updateSessionNotes } from '../data/store'
import { downloadCsv, fmtClock, fmtDateTime, toDayEnd, toDayStart } from '../utils'

const naturalSort = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })

function describeEvent(event) {
  switch (event.kind) {
    case 'episode':
      return `Episode, ${fmtClock(event.durationMs)}${event.intensity ? `, intensity ${event.intensity}/${event.scaleMax}` : ''}`
    case 'count':
      return `Episode (count)${event.intensity ? `, intensity ${event.intensity}/${event.scaleMax}` : ''}`
    case 'intensity':
      return `Intensity ${event.value}/${event.scaleMax}`
    case 'interval':
      return `${metricInfo(event.method)?.label || event.method}: ${event.occurred ? 'Yes' : 'No'} (interval ${event.intervalIndex + 1}, ${event.intervalSeconds}s)`
    case 'attempt':
      return 'Attempt'
    case 'success':
      return 'Success'
    default:
      return event.kind
  }
}

function summarize(events) {
  const out = {
    episodes: 0,
    durations: [],
    intensities: [],
    intervals: { partial: { yes: 0, total: 0 }, whole: { yes: 0, total: 0 }, mts: { yes: 0, total: 0 } },
    attempts: 0,
    successes: 0,
  }
  for (const event of events) {
    if (event.kind === 'episode' || event.kind === 'count') out.episodes += 1
    if (event.kind === 'episode') out.durations.push(event.durationMs || 0)
    if ((event.kind === 'episode' || event.kind === 'count') && event.intensity) out.intensities.push(event.intensity)
    if (event.kind === 'intensity') out.intensities.push(event.value)
    if (event.kind === 'interval' && out.intervals[event.method]) {
      out.intervals[event.method].total += 1
      if (event.occurred) out.intervals[event.method].yes += 1
    }
    if (event.kind === 'attempt') out.attempts += 1
    if (event.kind === 'success') out.successes += 1
  }
  return out
}

const avg = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const pct = ({ yes, total }) => (total ? `${Math.round((yes / total) * 100)}% (${yes}/${total})` : '\u2014')

export default function Review() {
  const { isAdmin } = useAuth()
  const { data: events, loading: loadingEvents, error: eventsError } = useAllEvents()
  const { data: sessions, loading: loadingSessions, error: sessionsError } = useSessions()
  const [tab, setTab] = useState('summary')
  const [filters, setFilters] = useState({ subject: '', behavior: '', from: '', to: '', observer: '' })

  const patch = (fields) => setFilters((current) => ({ ...current, ...fields }))

  const subjectOptions = useMemo(() => [...new Set(sessions.map((s) => s.subjectCode))].sort(naturalSort), [sessions])
  const behaviorOptions = useMemo(() => [...new Set(events.map((e) => e.behavior))].sort(naturalSort), [events])

  const sessionsById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions])

  const filteredSessions = useMemo(() => {
    const from = toDayStart(filters.from)
    const to = toDayEnd(filters.to)
    const observer = filters.observer.trim().toLowerCase()
    return sessions
      .filter((s) => !filters.subject || s.subjectCode === filters.subject)
      .filter((s) => from === null || s.startedAt >= from)
      .filter((s) => to === null || s.startedAt <= to)
      .filter((s) => !observer || (s.observerName || '').toLowerCase().includes(observer))
      .sort((a, b) => b.startedAt - a.startedAt)
  }, [sessions, filters])

  const filteredEvents = useMemo(() => {
    const allowed = new Set(filteredSessions.map((s) => s.id))
    return events
      .filter((e) => allowed.has(e.sessionId))
      .filter((e) => !filters.behavior || e.behavior === filters.behavior)
      .sort((a, b) => b.ts - a.ts)
  }, [events, filteredSessions, filters.behavior])

  const loading = loadingEvents || loadingSessions
  const error = eventsError || sessionsError

  return (
    <section className="card">
      <div className="section-heading">
        <h2>Review data</h2>
        <button
          type="button"
          onClick={() =>
            downloadCsv('behavior-data.csv', CSV_COLUMNS(sessionsById), filteredEvents)
          }
          disabled={!filteredEvents.length}
        >
          Export CSV ({filteredEvents.length})
        </button>
      </div>

      {error && <p className="error">Could not load data: {error.message}</p>}

      <div className="filters">
        <label>
          Subject
          <select value={filters.subject} onChange={(e) => patch({ subject: e.target.value })}>
            <option value="">All</option>
            {subjectOptions.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label>
          Behavior
          <select value={filters.behavior} onChange={(e) => patch({ behavior: e.target.value })}>
            <option value="">All</option>
            {behaviorOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => patch({ from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => patch({ to: e.target.value })} />
        </label>
        <label>
          Observer
          <input value={filters.observer} onChange={(e) => patch({ observer: e.target.value })} placeholder="Name contains..." />
        </label>
      </div>

      <div className="tabs">
        {[['summary', 'Summary & charts'], ['events', 'Events'], ['sessions', 'Sessions']].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'tab selected' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading&hellip;</p>}

      {tab === 'summary' && <SummaryTab events={filteredEvents} sessionsById={sessionsById} />}
      {tab === 'events' && <EventsTab events={filteredEvents} isAdmin={isAdmin} />}
      {tab === 'sessions' && <SessionsTab sessions={filteredSessions} events={filteredEvents} isAdmin={isAdmin} />}
    </section>
  )
}

const CSV_COLUMNS = (sessionsById) => [
  { label: 'Subject', value: (e) => e.subjectCode },
  { label: 'Behavior', value: (e) => e.behavior },
  { label: 'Type', value: (e) => e.kind },
  { label: 'Session start', value: (e) => (sessionsById.get(e.sessionId)?.startedAt ? new Date(sessionsById.get(e.sessionId).startedAt).toISOString() : '') },
  { label: 'Event time', value: (e) => (e.ts ? new Date(e.ts).toISOString() : '') },
  { label: 'Episode start', value: (e) => (e.startMs ? new Date(e.startMs).toISOString() : '') },
  { label: 'Episode end', value: (e) => (e.endMs ? new Date(e.endMs).toISOString() : '') },
  { label: 'Duration (sec)', value: (e) => (e.durationMs != null ? (e.durationMs / 1000).toFixed(1) : '') },
  { label: 'Intensity', value: (e) => (e.kind === 'intensity' ? e.value : e.intensity ?? '') },
  { label: 'Intensity scale max', value: (e) => e.scaleMax ?? '' },
  { label: 'Interval method', value: (e) => e.method ?? '' },
  { label: 'Interval length (sec)', value: (e) => e.intervalSeconds ?? '' },
  { label: 'Interval number', value: (e) => (e.intervalIndex != null ? e.intervalIndex + 1 : '') },
  { label: 'Occurred', value: (e) => (e.kind === 'interval' ? (e.occurred ? 'Yes' : 'No') : '') },
  { label: 'Observer', value: (e) => e.observerName },
  { label: 'Session ID', value: (e) => e.sessionId },
]

function SummaryTab({ events, sessionsById }) {
  const groups = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const key = `${event.subjectCode}||${event.behavior}`
      if (!map.has(key)) map.set(key, { key, subject: event.subjectCode, behavior: event.behavior, events: [] })
      map.get(key).events.push(event)
    }
    return [...map.values()].sort((a, b) => naturalSort(a.subject, b.subject) || naturalSort(a.behavior, b.behavior))
  }, [events])

  const intervalPct = (counts) => (counts.total ? Math.round((counts.yes / counts.total) * 100) : null)

  const [chartKey, setChartKey] = useState('')
  const chartGroup = groups.find((group) => group.key === chartKey) || groups[0]

  const chartData = useMemo(() => {
    if (!chartGroup) return []
    const bySession = new Map()
    for (const event of chartGroup.events) {
      if (!bySession.has(event.sessionId)) bySession.set(event.sessionId, [])
      bySession.get(event.sessionId).push(event)
    }
    return [...bySession.entries()]
      .map(([sessionId, sessionEvents]) => {
        const stats = summarize(sessionEvents)
        const startedAt = sessionsById.get(sessionId)?.startedAt || 0
        return {
          startedAt,
          label: fmtDateTime(startedAt),
          episodes: stats.episodes,
          durationMin: Number((stats.durations.reduce((a, b) => a + b, 0) / 60000).toFixed(2)),
          partialPct: intervalPct(stats.intervals.partial),
          wholePct: intervalPct(stats.intervals.whole),
          mtsPct: intervalPct(stats.intervals.mts),
          intensity: avg(stats.intensities) === null ? null : Number(avg(stats.intensities).toFixed(2)),
          successPct: stats.attempts ? Math.round((stats.successes / stats.attempts) * 100) : null,
        }
      })
      .sort((a, b) => a.startedAt - b.startedAt)
  }, [chartGroup, sessionsById])

  const intervalSeries = [
    { key: 'partialPct', name: 'Partial interval %', fill: '#f27d00' },
    { key: 'wholePct', name: 'Whole interval %', fill: '#1f2937' },
    { key: 'mtsPct', name: 'MTS %', fill: '#9ca3af' },
  ].filter((series) => chartData.some((row) => row[series.key] !== null))
  const hasIntensity = chartData.some((row) => row.intensity !== null)
  const hasSuccess = chartData.some((row) => row.successPct !== null)

  if (!groups.length) return <p className="muted">No data matches the current filters.</p>

  return (
    <div className="stack">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Subject</th><th>Behavior</th><th>Episodes</th><th>Total dur.</th><th>Mean dur.</th><th>Max dur.</th>
              <th>Avg intensity</th><th>Partial int.</th><th>Whole int.</th><th>MTS</th><th>Attempts</th><th>Successes</th><th>Success rate</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const s = summarize(group.events)
              const total = s.durations.reduce((a, b) => a + b, 0)
              const meanDuration = avg(s.durations)
              const meanIntensity = avg(s.intensities)
              return (
                <tr key={group.key}>
                  <td>{group.subject}</td>
                  <td>{group.behavior}</td>
                  <td>{s.episodes}</td>
                  <td>{s.durations.length ? fmtClock(total) : '\u2014'}</td>
                  <td>{meanDuration === null ? '\u2014' : fmtClock(meanDuration)}</td>
                  <td>{s.durations.length ? fmtClock(Math.max(...s.durations)) : '\u2014'}</td>
                  <td>{meanIntensity === null ? '\u2014' : meanIntensity.toFixed(2)}</td>
                  <td>{pct(s.intervals.partial)}</td>
                  <td>{pct(s.intervals.whole)}</td>
                  <td>{pct(s.intervals.mts)}</td>
                  <td>{s.attempts || '\u2014'}</td>
                  <td>{s.successes || '\u2014'}</td>
                  <td>{s.attempts ? `${Math.round((s.successes / s.attempts) * 100)}%` : '\u2014'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card inset">
        <div className="section-heading">
          <h3>Per-session chart</h3>
          <select value={chartGroup.key} onChange={(e) => setChartKey(e.target.value)}>
            {groups.map((group) => (
              <option key={group.key} value={group.key}>{group.subject} &ndash; {group.behavior}</option>
            ))}
          </select>
        </div>
        <div className="chart-grid">
          <div className="chart">
            <h4>Episodes per session</h4>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="episodes" name="Episodes" fill="#f27d00" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart">
            <h4>Total duration per session (min)</h4>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="durationMin" name="Duration (min)" fill="#1f2937" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {intervalSeries.length > 0 && (
            <div className="chart">
              <h4>Interval recording per session (% of intervals with behavior)</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  {intervalSeries.map((series) => (
                    <Bar key={series.key} dataKey={series.key} name={series.name} fill={series.fill} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {hasIntensity && (
            <div className="chart">
              <h4>Average intensity per session</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="intensity" name="Avg intensity" fill="#f27d00" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {hasSuccess && (
            <div className="chart">
              <h4>Trial success rate per session (%)</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Bar dataKey="successPct" name="Success rate %" fill="#15803d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventsTab({ events, isAdmin }) {
  const [limit, setLimit] = useState(200)
  const shown = events.slice(0, limit)

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th><th>Subject</th><th>Behavior</th><th>Entry</th><th>Observer</th>{isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={isAdmin ? 6 : 5} className="muted center">No events match the current filters.</td></tr>
            )}
            {shown.map((event) => (
              <tr key={event.id}>
                <td>{fmtDateTime(event.ts)}</td>
                <td>{event.subjectCode}</td>
                <td>{event.behavior}</td>
                <td>{describeEvent(event)}</td>
                <td>{event.observerName}</td>
                {isAdmin && (
                  <td>
                    <button
                      type="button"
                      className="btn-sm danger"
                      onClick={() => window.confirm('Delete this entry?') && deleteEvent(event.sessionId, event.id)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length > limit && (
        <div className="button-row">
          <button type="button" onClick={() => setLimit(limit + 200)}>Show more ({events.length - limit} remaining)</button>
        </div>
      )}
    </div>
  )
}

function SessionsTab({ sessions, events, isAdmin }) {
  const [editingId, setEditingId] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(null)

  const counts = useMemo(() => {
    const map = new Map()
    for (const event of events) map.set(event.sessionId, (map.get(event.sessionId) || 0) + 1)
    return map
  }, [events])

  async function remove(session) {
    if (!window.confirm(`Delete session for ${session.subjectCode} (${fmtDateTime(session.startedAt)}) and all of its entries?`)) return
    setBusy(session.id)
    try {
      await deleteSession(session.id)
    } catch (error) {
      window.alert(`Could not delete: ${error.message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Started</th><th>Subject</th><th>Observer</th><th>Length</th><th>Entries</th><th>Notes</th>{isAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr><td colSpan={isAdmin ? 7 : 6} className="muted center">No sessions match the current filters.</td></tr>
          )}
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>{fmtDateTime(session.startedAt)}</td>
              <td>{session.subjectCode}</td>
              <td>{session.observerName}</td>
              <td>{session.endedAt ? fmtClock(session.endedAt - session.startedAt) : 'In progress'}</td>
              <td>{counts.get(session.id) || 0}</td>
              <td>
                {editingId === session.id ? (
                  <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} />
                ) : (
                  session.notes || '\u2014'
                )}
              </td>
              {isAdmin && (
                <td>
                  <div className="btn-row-inline">
                    {editingId === session.id ? (
                      <>
                        <button type="button" className="btn-sm" onClick={() => { updateSessionNotes(session.id, notes); setEditingId(null) }}>Save</button>
                        <button type="button" className="btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button type="button" className="btn-sm" onClick={() => { setEditingId(session.id); setNotes(session.notes || '') }}>Edit notes</button>
                    )}
                    <button type="button" className="btn-sm danger" disabled={busy === session.id} onClick={() => remove(session)}>Delete</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
