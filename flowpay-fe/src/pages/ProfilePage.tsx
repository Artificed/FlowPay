import { useAuth } from "@/providers/AuthProvider"

export default function ProfilePage() {
  const { user } = useAuth()
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-lg font-semibold text-white">Profile</h1>
      <div className="mt-8 rounded-2xl border border-white/5 p-8">
        <p className="text-sm text-zinc-400">{user?.display_name}</p>
        <p className="text-xs text-zinc-600">{user?.email}</p>
      </div>
    </div>
  )
}
