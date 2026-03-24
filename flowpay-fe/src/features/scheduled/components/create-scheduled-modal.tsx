import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { useState } from "react"
import { scheduledPaymentService } from "../services"
import { useCurrencies } from "@/features/wallet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const schema = z.object({
  recipient_wallet_id: z.string().uuid("Must be a valid wallet ID"),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount")
    .refine((v) => parseFloat(v) > 0, "Amount must be greater than zero"),
  currency: z.string().min(1, "Select a currency"),
  note: z.string().max(500).optional(),
  interval_days: z
    .string()
    .regex(/^\d+$/, "Must be a whole number")
    .refine((v) => parseInt(v, 10) > 0, "Must be at least 1 day"),
  first_run_at: z.string().min(1, "Select a date and time").refine((v) => {
    return new Date(v) > new Date()
  }, "First run must be in the future"),
})

type FormData = z.infer<typeof schema>

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateScheduledModal({ onClose, onSuccess }: Props) {
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
      await scheduledPaymentService.create({
        recipient_wallet_id: data.recipient_wallet_id,
        amount: Math.round(parseFloat(data.amount) * 100),
        currency: data.currency,
        note: data.note || undefined,
        interval_days: parseInt(data.interval_days, 10),
        first_run_at: new Date(data.first_run_at).toISOString(),
      })
      onSuccess()
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to schedule payment")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md rounded-2xl border border-white/8 bg-zinc-900 p-8 shadow-2xl"
      >
        <DialogClose className="absolute right-6 top-6 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300">
          <X className="size-5" />
        </DialogClose>

        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">Schedule payment</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">Set up a recurring transfer</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient_wallet_id">Recipient wallet ID</Label>
            <Input
              id="recipient_wallet_id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="h-10 font-mono text-sm"
              {...register("recipient_wallet_id")}
            />
            {errors.recipient_wallet_id && (
              <p className="text-destructive text-xs">{errors.recipient_wallet_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-10 w-full border-white/10 bg-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.currency && (
                <p className="text-destructive text-xs">{errors.currency.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval_days">Repeat every (days)</Label>
            <Input
              id="interval_days"
              type="number"
              min="1"
              placeholder="7"
              className="h-10"
              {...register("interval_days")}
            />
            {errors.interval_days && (
              <p className="text-destructive text-xs">{errors.interval_days.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="first_run_at">First run</Label>
            <Input
              id="first_run_at"
              type="datetime-local"
              className="h-10"
              {...register("first_run_at")}
            />
            {errors.first_run_at && (
              <p className="text-destructive text-xs">{errors.first_run_at.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="note" placeholder="What's this for?" className="h-10" {...register("note")} />
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
              {isSubmitting ? "Scheduling…" : "Schedule payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
