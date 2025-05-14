"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User, LogOut, Shield, Settings, Car } from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()
  const { user, logout, isAdmin } = useAuth()

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
          {user && (
            <nav className="hidden md:flex gap-6">
              {isAdmin ? (
                <>
                  <Link
                    href="/admin"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      pathname === "/admin" ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Tổng quan
                  </Link>
                  <Link
                    href="/admin/users"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      pathname.startsWith("/admin/users") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Quản lý tài khoản
                  </Link>
                  <Link
                    href="/admin/service-fees"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      pathname.startsWith("/admin/service-fees") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Phí dịch vụ
                  </Link>
                  <Link
                    href="/admin/logs"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      pathname.startsWith("/admin/logs") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Nhật ký
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/user"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      pathname === "/user" ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    Quản lý xe
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <User className="h-4 w-4" />
                  <span className="sr-only">Tài khoản</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>{user.email}</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        <span>Quản trị</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/account">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Tài khoản admin</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Đăng nhập</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
