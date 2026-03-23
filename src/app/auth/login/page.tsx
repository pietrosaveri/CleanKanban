'use client'

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabaseClient'

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-tight mb-1">Kanban</h1>
        <p className="text-sm text-gray-400 mb-10">Minimal realtime collaborative board</p>
        <button
          onClick={handleLogin}
          className="border border-black px-6 py-2 text-sm rounded hover:bg-black hover:text-white transition-colors duration-150"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
