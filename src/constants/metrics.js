export const METRIC_TYPES = [
  { id: 'frequency', label: 'Frequency', description: 'Count of episodes' },
  { id: 'duration', label: 'Duration', description: 'Start/stop timing of each episode' },
  { id: 'intensity', label: 'Intensity', description: 'Rating on an admin-defined scale', defaults: { scaleMax: 3 } },
  { id: 'partial', label: 'Partial interval', description: 'Occurred at any point in the interval', defaults: { intervalSeconds: 30 } },
  { id: 'whole', label: 'Whole interval', description: 'Occurred throughout the whole interval', defaults: { intervalSeconds: 30 } },
  { id: 'mts', label: 'Momentary time sampling', description: 'Occurring at the end of the interval', defaults: { intervalSeconds: 30 } },
  { id: 'attempts', label: 'Frequency of attempts', description: 'Tap counter for attempts' },
  { id: 'successes', label: 'Frequency of successes', description: 'Tap counter for successes' },
]

export const INTERVAL_METRICS = ['partial', 'whole', 'mts']

export const INTERVAL_PRESETS = [5, 10, 15, 20, 30, 60, 120, 300]

export const INTERVAL_QUESTIONS = {
  partial: 'Did it occur at any point during the interval?',
  whole: 'Did it occur throughout the entire interval?',
  mts: 'Is it occurring right now?',
}

export function metricInfo(type) {
  return METRIC_TYPES.find((metric) => metric.id === type)
}

export function defaultMetric(type) {
  return { type, ...(metricInfo(type)?.defaults || {}) }
}

export function metricLabel(metric) {
  const info = metricInfo(metric.type)
  const name = info ? info.label : metric.type
  if (INTERVAL_METRICS.includes(metric.type)) return `${name} (${metric.intervalSeconds}s)`
  if (metric.type === 'intensity') return `${name} (1\u2013${metric.scaleMax})`
  return name
}

const THREE_POINT_LABELS = ['Mild', 'Moderate', 'Severe']

export function intensityLabel(value, scaleMax) {
  return scaleMax === 3 ? `${value} \u2013 ${THREE_POINT_LABELS[value - 1]}` : String(value)
}

export function formatIntervalLength(seconds) {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} sec`
}
