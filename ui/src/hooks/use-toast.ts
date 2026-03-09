import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

function toast(opts: ToastOptions) {
  const message = opts.title || opts.description || ""
  const description = opts.title ? opts.description : undefined

  if (opts.variant === "destructive") {
    sonnerToast.error(message, { description })
  } else {
    sonnerToast.success(message, { description })
  }
}

function useToast() {
  return { toast }
}

export { useToast, toast }
