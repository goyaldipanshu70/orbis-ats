import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  action?: { label: string; onClick: () => void }
  duration?: number
}

function toast(opts: ToastOptions) {
  const message = opts.title || opts.description || ""
  const description = opts.title ? opts.description : undefined
  const extra: Record<string, unknown> = {}
  if (opts.action) extra.action = opts.action
  if (opts.duration) extra.duration = opts.duration

  if (opts.variant === "destructive") {
    sonnerToast.error(message, { description, ...extra })
  } else {
    sonnerToast.success(message, { description, ...extra })
  }
}

function useToast() {
  return { toast }
}

export { useToast, toast }
