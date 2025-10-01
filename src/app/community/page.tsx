"use client"
import { Nav } from '@/components/Nav'
import { Panel } from '@/components/Cards'
import { useAppStore } from '@/lib/storage'
import { useState } from 'react'

export default function CommunityPage() {
  const { currentUser, posts, addPost, toggleLike } = useAppStore()
  const [text, setText] = useState('')

  const submit = () => {
    if (!text.trim()) return
    addPost(text.trim())
    setText('')
  }

  return (
    <div>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <Panel title="Share a tip or ask a question">
          {!currentUser && <div className="text-sm text-slate-400">Please sign in on Profile page.</div>}
          {currentUser && (
            <div className="flex gap-2">
              <input className="card flex-1 px-3 py-2" placeholder="Write something..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key==='Enter' && submit()} />
              <button className="btn btn-primary" onClick={submit}>Post</button>
            </div>
          )}
        </Panel>

        <Panel title="Community Feed">
          <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                <div className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleString()}</div>
                <div className="mt-1">{p.content}</div>
                <div className="mt-2">
                  <button className="btn btn-secondary" onClick={() => toggleLike(p.id)}>Like ({p.likes})</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </main>
    </div>
  )
}

