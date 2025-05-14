"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Users, Shield, BarChart3, CreditCard, FileText } from "lucide-react"

interface SidebarItem {
  title: string
  href: string
  icon: React.ReactNode
}

export default function AdminSidebar() {
  const pathname = usePathname()

  const sidebarItems: SidebarItem[] = [
    {
      title: "Tổng quan",
      href: "/admin",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      title: "Quản lý người dùng",
      href: "/admin/users",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Phí dịch vụ",
      href: "/admin/service-fees",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      title: "Nhật ký hệ thống",
      href: "/admin/logs",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Tài khoản admin",
      href: "/admin/account",
      icon: <Shield className="h-5 w-5" />,
    },
  ]

  return (
    <div className="hidden md:flex flex-col w-64 border-r bg-muted/40">
      <div className="p-6">
        <h2 className="text-lg font-semibold">Quản trị hệ thống</h2>
        <p className="text-sm text-muted-foreground">Quản lý và điều hành</p>
      </div>
      <ScrollArea className="flex-1">
        <nav className="grid gap-1 px-2">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href} passHref>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2 px-3 py-2 h-auto",
                  pathname === item.href && "bg-accent text-accent-foreground",
                )}
              >
                {item.icon}
                <span>{item.title}</span>
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}
