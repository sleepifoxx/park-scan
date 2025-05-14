"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"

type User = {
  id: string
  email: string
  name: string
  role: "user" | "admin"
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const { toast } = useToast()
  const isAdmin = user?.role === "admin"

  // Check if user is logged in on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  // Mock login function
  const login = async (email: string, password: string) => {
    try {
      // In a real app, this would be an API call
      if (email === "admin@example.com" && password === "password") {
        const user = {
          id: "1",
          email: "admin@example.com",
          name: "Admin User",
          role: "admin" as const,
        }
        setUser(user)
        localStorage.setItem("user", JSON.stringify(user))
        toast({
          title: "Đăng nhập thành công",
          description: "Chào mừng bạn quay trở lại!",
        })
        router.push("/admin")
      } else if (email === "user@example.com" && password === "password") {
        const user = {
          id: "2",
          email: "user@example.com",
          name: "Regular User",
          role: "user" as const,
        }
        setUser(user)
        localStorage.setItem("user", JSON.stringify(user))
        toast({
          title: "Đăng nhập thành công",
          description: "Chào mừng bạn quay trở lại!",
        })
        router.push("/user")
      } else {
        throw new Error("Email hoặc mật khẩu không đúng")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Đăng nhập thất bại",
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi",
      })
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
    toast({
      title: "Đăng xuất thành công",
      description: "Hẹn gặp lại bạn!",
    })
    router.push("/login")
  }

  return <AuthContext.Provider value={{ user, login, logout, isAdmin }}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
