import { toast } from 'sonner'

type ToastOptions = {
    description?: string
    duration?: number
}

// Normal Toast
export function showToast(message: string, options?: ToastOptions) {
    toast(message, {
        description: options?.description,
        duration: options?.duration ?? 3000
    })
}
// Success Toast
export function showSuccessToast(message: string, options?: ToastOptions) {
    toast.success(message, {
        description: options?.description,
        duration: options?.duration ?? 3000
    })
}

// Error Toast
export function showErrorToast(message: string, options?: ToastOptions) {
    toast.error(message, {
        description: options?.description,
        duration: options?.duration ?? 4000
    })
}

// Warning Toast
export function showWarningToast(message: string, options?: ToastOptions) {
    toast.warning(message, {
        description: options?.description,
        duration: options?.duration ?? 3500
    })
}
