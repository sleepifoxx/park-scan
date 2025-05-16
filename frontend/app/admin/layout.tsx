"use client"

import Cookies from "js-cookie"
import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AdminSidebar from "@/components/admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    const userStr = Cookies.get("user")
    if (!userStr) {
      router.replace("/login")
      return
    }
    const userObj = JSON.parse(userStr)
    if (userObj.role !== "admin") {
      router.replace("/login")
      return
    }
    setUser(userObj)
    setLoading(false)
  }, [router])

  if (loading) return null

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">{children}</div>
    </div>
  )
}
