"use client"
import { Nav } from '@/components/Nav'
import { Panel } from '@/components/Cards'
import { useAppStore } from '@/lib/storage'
import { useForm } from 'react-hook-form'

type AuthForm = { email: string, name?: string, userType?: 'personal' | 'small_business' | 'gig_worker' }

export default function ProfilePage() {
  const { currentUser, users, signUp, login, logout } = useAppStore()
  const { register, handleSubmit, reset } = useForm<AuthForm>({})

  const onSignup = (d: AuthForm) => {
    if (!d.email || !d.name || !d.userType) return
    signUp(d.email, d.name, d.userType)
    reset({})
  }
  const onLogin = (d: AuthForm) => {
    if (!d.email) return
    login(d.email)
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Panel title="Account">
          {currentUser ? (
            <div className="space-y-2">
              <div className="text-sm">Signed in as <span className="font-medium">{currentUser.name}</span> ({currentUser.email})</div>
              <div className="text-sm">Type: <span className="capitalize">{currentUser.userType.replace('_',' ')}</span></div>
              <div className="text-sm">Badges: {currentUser.badges.length ? currentUser.badges.join(', ') : 'None'}</div>
              <button className="btn btn-secondary" onClick={logout}>Logout</button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <form onSubmit={handleSubmit(onLogin)} className="space-y-2">
                <div className="font-medium">Login</div>
                <input className="card px-3 py-2 w-full" placeholder="Email" {...register('email')} />
                <button className="btn btn-primary" type="submit">Login</button>
              </form>
              <form onSubmit={handleSubmit(onSignup)} className="space-y-2">
                <div className="font-medium">Sign up</div>
                <input className="card px-3 py-2 w-full" placeholder="Email" {...register('email')} />
                <input className="card px-3 py-2 w-full" placeholder="Name" {...register('name')} />
                <select className="card px-3 py-2 w-full" {...register('userType')}>
                  <option value="personal">Personal</option>
                  <option value="small_business">Small Business</option>
                  <option value="gig_worker">Gig Worker</option>
                </select>
                <button className="btn btn-primary" type="submit">Create account</button>
              </form>
            </div>
          )}
        </Panel>

        <Panel title="All Users">
          <ul className="text-sm text-slate-300 space-y-1">
            {Object.values(users).map(u => (
              <li key={u.id} className="flex items-center justify-between border border-slate-800 rounded-lg p-2 bg-slate-900/50">
                <div>{u.name} <span className="text-slate-400">({u.userType.replace('_',' ')})</span></div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  )
}

