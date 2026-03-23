import { CalendarClock } from "lucide-react"

export default function ScheduledPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-lg font-semibold text-white">Scheduled Payments</h1>
      <div className="mt-8 rounded-2xl border border-white/5 py-16 text-center">
        <CalendarClock className="mx-auto mb-3 size-8 text-zinc-700" />
        <p className="text-sm text-zinc-600">Scheduled payments coming soon.</p>
      </div>
    </div>
  )
}
