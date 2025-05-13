"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import AdminSidebar from "@/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect if not logged in or not an admin
    if (!user || !isAdmin) {
      router.push("/login")
    }
  }, [user, isAdmin, router])

  // Don't render anything until we've checked authentication
  if (!user || !isAdmin) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">{children}</div>
    </div>
  )
}
