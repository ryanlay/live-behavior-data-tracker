import { useState } from 'react'
import { TARGET_BEHAVIORS } from '../constants/behaviors'
import {
  INTERVAL_METRICS,
  INTERVAL_PRESETS,
  METRIC_TYPES,
  defaultMetric,
  formatIntervalLength,
} from '../constants/metrics'
import { useSubjects } from '../data/hooks'
import { isFirebaseConfigured } from '../firebase'
import { createSubject, saveSubjectFields } from '../data/store'

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,19}$/

export default function Admin() {
  const { data: subjects, loading, error } = useSubjects()
  const [newCode, setNewCode] = useState('')
  const [message, setMessage] = useState(null)
  const [selectedCode, setSelectedCode] = useState(null)

  const sorted = [...subjects].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
  const selected = subjects.find((subject) => subject.code === selectedCode) || null

  function addSubject(event) {
    event.preventDefault()
    if (!isFirebaseConfigured) {
      setMessage({ error: true, text: 'Firebase is not configured yet (see README).' })
      return
    }
    const code = newCode.trim().toUpperCase()
    if (!CODE_PATTERN.test(code)) {
      setMessage({ error: true, text: 'Use 2-20 letters, numbers, dashes or underscores (e.g. CSH05).' })
      return
    }
    if (subjects.some((subject) => subject.code === code)) {
      setMessage({ error: true, text: `${code} already exists.` })
      return
    }
    createSubject(code)
    setNewCode('')
    setSelectedCode(code)
    setMessage({ error: false, text: `Added ${code}.` })
  }

  return (
    <div className="admin-grid">
      <section className="card">
        <h2>Subjects</h2>
        <form className="inline-form" onSubmit={addSubject}>
          <input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="Subject ID, e.g. CSH05" />
          <button type="submit" className="primary">Add</button>
        </form>
        {message && <p className={message.error ? 'error' : 'success'}>{message.text}</p>}
        {error && <p className="error">Could not load subjects: {error.message}</p>}
        {loading && <p className="muted">Loading&hellip;</p>}
        <ul className="list">
          {sorted.map((subject) => (
            <li key={subject.code} className={`list-item ${subject.code === selectedCode ? 'selected' : ''}`}>
              <button type="button" className="link-button" onClick={() => setSelectedCode(subject.code)}>
                <strong>{subject.code}</strong>
                <small>
                  {(subject.targets || []).length} behavior(s){subject.isActive ? '' : ' \u00b7 inactive'}
                </small>
              </button>
            </li>
          ))}
          {!loading && sorted.length === 0 && <li className="muted">No subjects yet.</li>}
        </ul>
      </section>

      <section className="card">
        {selected ? <SubjectEditor key={selected.code} subject={selected} /> : <p className="muted">Select or add a subject to set up its target behaviors.</p>}
      </section>
    </div>
  )
}

function SubjectEditor({ subject }) {
  const targets = subject.targets || []
  const available = TARGET_BEHAVIORS.filter((name) => !targets.some((target) => target.behavior === name))
  const [pick, setPick] = useState('')

  const saveTargets = (next) => saveSubjectFields(subject.code, { targets: next })

  function addBehavior() {
    if (!pick) return
    saveTargets([...targets, { behavior: pick, metrics: [defaultMetric('frequency'), defaultMetric('duration')] }])
    setPick('')
  }

  const updateTarget = (behavior, updater) =>
    saveTargets(targets.map((target) => (target.behavior === behavior ? updater(target) : target)))

  return (
    <div>
      <div className="section-heading">
        <h2>{subject.code}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={subject.isActive !== false}
            onChange={(event) => saveSubjectFields(subject.code, { isActive: event.target.checked })}
          />
          Active (visible to Users)
        </label>
      </div>

      <div className="inline-form">
        <select value={pick} onChange={(event) => setPick(event.target.value)}>
          <option value="">Add a target behavior&hellip;</option>
          {available.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button type="button" className="primary" onClick={addBehavior} disabled={!pick}>Add behavior</button>
      </div>

      {targets.length === 0 && <p className="muted">No target behaviors yet. Users will not be able to collect data for this subject.</p>}

      <div className="stack">
        {targets.map((target) => (
          <TargetCard
            key={target.behavior}
            target={target}
            onChange={(updater) => updateTarget(target.behavior, updater)}
            onRemove={() => {
              if (window.confirm(`Remove ${target.behavior} from ${subject.code}? Past data is kept.`)) {
                saveTargets(targets.filter((entry) => entry.behavior !== target.behavior))
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TargetCard({ target, onChange, onRemove }) {
  const metricFor = (type) => target.metrics.find((metric) => metric.type === type)

  function toggle(type) {
    onChange((current) => ({
      ...current,
      metrics: metricFor(type)
        ? current.metrics.filter((metric) => metric.type !== type)
        : [...current.metrics, defaultMetric(type)],
    }))
  }

  const patch = (type, fields) =>
    onChange((current) => ({
      ...current,
      metrics: current.metrics.map((metric) => (metric.type === type ? { ...metric, ...fields } : metric)),
    }))

  return (
    <article className="card inset">
      <div className="section-heading">
        <h3>{target.behavior}</h3>
        <button type="button" className="danger" onClick={onRemove}>Remove</button>
      </div>
      <div className="metric-list">
        {METRIC_TYPES.map((info) => {
          const metric = metricFor(info.id)
          return (
            <div key={info.id} className={`metric-row ${metric ? 'on' : ''}`}>
              <label className="toggle">
                <input type="checkbox" checked={Boolean(metric)} onChange={() => toggle(info.id)} />
                <span>
                  <strong>{info.label}</strong>
                  <small>{info.description}</small>
                </span>
              </label>
              {metric && INTERVAL_METRICS.includes(info.id) && (
                <label className="metric-config">
                  Interval
                  <select
                    value={metric.intervalSeconds}
                    onChange={(event) => patch(info.id, { intervalSeconds: Number(event.target.value) })}
                  >
                    {[...new Set([...INTERVAL_PRESETS, metric.intervalSeconds])]
                      .sort((a, b) => a - b)
                      .map((seconds) => (
                        <option key={seconds} value={seconds}>{formatIntervalLength(seconds)}</option>
                      ))}
                  </select>
                </label>
              )}
              {metric && info.id === 'intensity' && (
                <label className="metric-config">
                  Scale 1&ndash;
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={metric.scaleMax}
                    onChange={(event) => patch('intensity', { scaleMax: Math.min(10, Math.max(2, Number(event.target.value) || 3)) })}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
      {target.metrics.length === 0 && <p className="error">Select at least one metric.</p>}
    </article>
  )
}
