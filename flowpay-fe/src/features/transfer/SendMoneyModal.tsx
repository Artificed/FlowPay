import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X } from "lucide-react"
import { useState, useRef } from "react"
import { transferService } from "./services"
import { useCurrencies } from "@/features/wallet/useCurrencies"
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
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount").refine((v) => parseFloat(v) > 0, "Amount must be greater than zero"),
  currency: z.string().min(1, "Select a currency"),
  note: z.string().max(500).optional(),
})

type FormData = z.infer<typeof schema>

type Props = {
  onClose: () => void
  onSuccess: () => void
  onFail?: () => void
}

export default function SendMoneyModal({ onClose, onSuccess, onFail }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { currencies, currencyError } = useCurrencies()
  const idempotencyKey = useRef(crypto.randomUUID())

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
      await transferService.createTransfer(
        {
          recipient_wallet_id: data.recipient_wallet_id,
          amount: Math.round(parseFloat(data.amount) * 100),
          currency: data.currency,
          note: data.note || undefined,
        },
        idempotencyKey.current,
      )
      onSuccess()
      onClose()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Transfer failed")
      onFail?.()
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
          <DialogTitle className="text-xl font-semibold tracking-tight text-white">Send money</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">Transfer funds to another wallet</DialogDescription>
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
                        {c.code} — {c.name}
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
              {isSubmitting ? "Sending…" : "Send money"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
