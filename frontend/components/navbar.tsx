"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import Cookies from "js-cookie"
import { useEffect, useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, LogIn, Car } from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const userStr = Cookies.get("user")
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr)
        setUsername(userObj.username)
      } catch {
        setUsername(null)
      }
    } else {
      setUsername(null)
    }
  }, [])

  // Don't show navbar on login page
  if (pathname === "/login") {
    return null
  }

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl flex items-center">
            <Car className="h-5 w-5 mr-2 text-primary" />
            LPRS
          </Link>
          {/* All navigation links removed */}
        </div>
        <div className="flex items-center gap-4">
          {username ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 px-2 py-1">
                  <User className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">Xin chào, {username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    Cookies.remove("user")
                    window.location.href = "/login"
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              className="flex items-center gap-2 px-2 py-1"
              onClick={() => (window.location.href = "/login")}
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
