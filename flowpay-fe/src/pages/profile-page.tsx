import { useEffect, useRef, useState } from "react"
import { Camera, Check, KeyRound, Pencil, X, CalendarDays, ArrowLeftRight, ShieldCheck } from "lucide-react"
import { useAuth } from "@/features/auth"
import { profileService } from "@/features/profile/services"
import { walletService, WalletIDCopy } from "@/features/wallet"
import { transferService } from "@/features/transfer/services"
import type { Wallet } from "@/features/wallet/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/primitives/avatar"
import { Input } from "@/shared/ui/primitives/input"

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(user?.display_name ?? "")
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [txnCount, setTxnCount] = useState<number | null>(null)

  const [currentPwd, setCurrentPwd] = useState("")
  const [newPwd, setNewPwd] = useState("")
  const [confirmPwd, setConfirmPwd] = useState("")
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)

  useEffect(() => {
    walletService.getWallet().then(setWallet).catch(() => null)
    transferService.listTransfers({ limit: 1, offset: 0 }).then((r) => setTxnCount(r.total)).catch(() => null)
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarLoading(true)
    setAvatarError(null)
    try {
      const updated = await profileService.uploadAvatar(file)
      updateUser({
        ...updated,
        avatar_url: updated.avatar_url ? `${updated.avatar_url}?t=${Date.now()}` : null,
      })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setAvatarLoading(false)
      e.target.value = ""
    }
  }

  async function handleRemove() {
    if (!user?.avatar_url) return
    setAvatarLoading(true)
    setAvatarError(null)
    try {
      await profileService.removeAvatar()
      updateUser({ ...user, avatar_url: null })
    } catch {
      setAvatarError("Failed to remove photo")
    } finally {
      setAvatarLoading(false)
    }
  }

  async function handleSaveName() {
    setNameLoading(true)
    setNameError(null)
    try {
      const updated = await profileService.updateProfile({ display_name: nameValue })
      updateUser(updated)
      setEditingName(false)
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setNameLoading(false)
    }
  }

  function handleCancelName() {
    setNameValue(user?.display_name ?? "")
    setNameError(null)
    setEditingName(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(false)
    if (newPwd !== confirmPwd) {
      setPwdError("Passwords don't match")
      return
    }
    setPwdLoading(true)
    try {
      await profileService.changePassword({ current_password: currentPwd, new_password: newPwd })
      setCurrentPwd("")
      setNewPwd("")
      setConfirmPwd("")
      setPwdSuccess(true)
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setPwdLoading(false)
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-4">
      <div className="mb-4">
        <h1 className="text-[1.4rem] font-semibold text-white">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your identity and security</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/8 to-white/3">
        <div className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 -bottom-8 size-40 rounded-full bg-violet-500/8 blur-3xl" />

        <div className="relative p-7">
          <div className="flex items-center gap-5">
            <div className="group relative shrink-0">
              <Avatar className="size-[80px] ring-2 ring-white/10">
                <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.display_name} />
                <AvatarFallback className="bg-indigo-500/20 text-2xl font-semibold text-indigo-300">
                  {user?.display_name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
              >
                <Camera className="size-4 text-white" />
              </button>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="h-8 w-48 border-white/10 bg-white/8 text-base font-semibold text-white focus-visible:ring-indigo-500/40"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName()
                      if (e.key === "Escape") handleCancelName()
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameLoading}
                    className="flex size-6 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    onClick={handleCancelName}
                    className="flex size-6 items-center justify-center rounded-full bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <div className="group/name flex items-center gap-1.5">
                  <span className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
                    {user?.display_name}
                  </span>
                  <button
                    onClick={() => { setNameValue(user?.display_name ?? ""); setEditingName(true) }}
                    className="flex size-5 items-center justify-center rounded-full text-zinc-700 opacity-0 transition-all hover:text-zinc-400 group-hover/name:opacity-100"
                  >
                    <Pencil className="size-2.5" />
                  </button>
                </div>
              )}

              {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
              <p className="mt-0.5 text-sm text-zinc-400">{user?.email}</p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {avatarLoading ? "Uploading…" : "Change photo"}
                </button>
                {user?.avatar_url && (
                  <button
                    onClick={handleRemove}
                    disabled={avatarLoading}
                    className="rounded-full px-3 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {avatarError && <p className="mt-1.5 text-xs text-red-400">{avatarError}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t border-white/6">
          <div className="flex items-center gap-4 px-5 py-4">
            <CalendarDays className="size-5 shrink-0 text-zinc-500" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Since</p>
              <p className="mt-0.5 truncate text-sm font-medium text-zinc-200">{memberSince ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 border-x border-white/6 px-5 py-4">
            <ArrowLeftRight className="size-5 shrink-0 text-zinc-500" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Transactions</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-200">
                {txnCount !== null ? txnCount.toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Wallet ID</p>
              <div className="mt-1">
                {wallet
                  ? <WalletIDCopy id={wallet.id} />
                  : <span className="text-xs text-zinc-600">—</span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/3">
        <div className="grid md:grid-cols-[1fr_1.4fr]">
          <div className="border-b border-white/5 p-7 md:border-b-0 md:border-r">
            <div className="flex size-10 items-center justify-center rounded-xl border border-white/8 bg-white/5">
              <KeyRound className="size-4 text-zinc-400" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-white">Change password</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
              Update your password to keep your account secure.
            </p>
            <div className="mt-5 space-y-2">
              {[
                "Use at least 8 characters",
                "Mix letters, numbers, and symbols",
                "New password must be different from your current password",
              ].map((tip) => (
                <div key={tip} className="flex items-center gap-2">
                  <ShieldCheck className="size-3 shrink-0 text-zinc-700" />
                  <span className="text-xs text-zinc-600">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-7">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Current password</label>
                <Input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  required
                  className="border-white/8 bg-white/5 text-white placeholder:text-zinc-700 focus-visible:ring-indigo-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">New password</label>
                <Input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  className="border-white/8 bg-white/5 text-white placeholder:text-zinc-700 focus-visible:ring-indigo-500/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Confirm new password</label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  required
                  className="border-white/8 bg-white/5 text-white placeholder:text-zinc-700 focus-visible:ring-indigo-500/40"
                />
              </div>

              {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
              {pwdSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400">Password updated successfully</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pwdLoading}
                className="mt-1 w-full rounded-full bg-white py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                {pwdLoading ? "Saving…" : "Update password"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
