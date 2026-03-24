type Props = { message: string | null | undefined }

export function FormErrorMessage({ message }: Props) {
  if (!message) return null
  return (
    <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm">
      {message}
    </p>
  )
}
