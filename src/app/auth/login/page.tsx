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
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-[56px] font-semibold tracking-[-0.28px] leading-[1.07] text-white mb-4">CleanKanban</h1>
        <p className="text-[17px] text-white/50 tracking-[-0.374px] leading-[1.47] mb-12">Minimal realtime collaborative board</p>
        <button
          onClick={handleLogin}
          className="bg-[#0071e3] text-white text-[17px] tracking-[-0.374px] px-6 py-2 rounded-lg hover:bg-[#0077ed] transition-colors duration-150"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
