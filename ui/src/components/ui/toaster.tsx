import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={3500}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isError = variant === "destructive"
        const Icon = isError ? AlertCircle : CheckCircle2
        const iconColor = isError ? "text-red-500" : "text-emerald-500"

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-center gap-3 py-2.5 px-3 pr-8 w-full">
              <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
              <div className="grid gap-0.5 min-w-0">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
