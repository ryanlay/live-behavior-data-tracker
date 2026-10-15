import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Brand from './Brand'

export default function Login() {
  const { signIn } = useAuth()
  const [name, setName] = useState('')
  const [role, setRole] = useState('user')

  function submit(event) {
    event.preventDefault()
    if (name.trim()) signIn(name, role)
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <Brand size="lg" />
        <p className="eyebrow">Clinical data collection</p>
        <h1>Live Behavior Data Tracker</h1>
        <p className="muted">
          Test sign-in. Use dummy data only &mdash; real authentication (SSO) is not set up yet.
        </p>
        <label>
          Your name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jordan" autoFocus />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="user">User &mdash; collect and review data</option>
            <option value="admin">Admin &mdash; also manage subjects and behaviors</option>
          </select>
        </label>
        <button type="submit" className="primary" disabled={!name.trim()}>
          Sign in
        </button>
      </form>
    </div>
  )
}
