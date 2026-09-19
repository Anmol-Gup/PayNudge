import { useEffect } from 'react'
import { useToast } from './ui/Toast'

/**
 * Supabase redirects back to the site's root URL with `#error=...` in the
 * hash when an email link (confirmation, password reset) is invalid, expired,
 * or already used. Without this, the app silently shows whatever page it
 * landed on with no indication anything went wrong.
 */
export function AuthRedirectErrorHandler() {
  const toast = useToast()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('error=')) return

    const params = new URLSearchParams(hash.slice(1))
    const code = params.get('error_code')
    const description = params.get('error_description')

    if (code === 'otp_expired') {
      toast.error('That link has expired or was already used. Please request a new one.')
    } else {
      toast.error(description || 'Something went wrong with that link.')
    }

    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  return null
}
