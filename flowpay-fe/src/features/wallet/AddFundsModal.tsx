import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { useState } from "react"
import { walletService } from "./services"
import { useCurrencies } from "./useCurrencies"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount").refine((v) => parseFloat(v) > 0, "Amount must be greater than zero"),
  currency: z.string().min(1, "Select a currency"),
})

type FormData = z.infer<typeof schema>

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function AddFundsModal({ onClose, onSuccess }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { currencies, currencyError } = useCurrencies()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "USD" },
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      await walletService.deposit({
        amount: Math.round(parseFloat(data.amount) * 100),
        currency: data.currency,
      })
      onSuccess()
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Deposit failed")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/8 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <h2 className="text-xl font-semibold tracking-tight text-white">Add funds</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Deposit money into your wallet</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" placeholder="0.00" className="h-10" {...register("amount")} />
            {errors.amount && (
              <p className="text-destructive text-xs">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <select
                  id="currency"
                  className="h-10 w-full rounded-md border border-white/10 bg-zinc-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.currency && (
              <p className="text-destructive text-xs">{errors.currency.message}</p>
            )}
          </div>

          {(serverError || currencyError) && (
            <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
              {serverError || currencyError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="h-10 flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="h-10 flex-1">
              {isSubmitting ? "Adding…" : "Add funds"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
