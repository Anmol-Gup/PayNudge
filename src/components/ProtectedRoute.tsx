import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppShell } from './AppShell'
import { Skeleton } from './ui/Skeleton'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <AppShell>{children}</AppShell>
}
