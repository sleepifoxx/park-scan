"use client"

import { useEffect, useState } from "react"
import { Users, Car, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  getAllUsers,
  getAllParkingSessions,
} from "@/api/api_backend"

export default function AdminDashboard() {
  const [userCount, setUserCount] = useState<number | null>(null)
  const [vehicleCount, setVehicleCount] = useState<number | null>(null)
  const [revenue, setRevenue] = useState<number | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      // Get users
      const usersRes = await getAllUsers()
      setUserCount(usersRes?.users?.length ?? 0)

      // Get parking sessions
      const sessionsRes = await getAllParkingSessions()
      const sessions = sessionsRes?.sessions ?? []

      setVehicleCount(sessions.length)

      // Revenue: sum all session.fee
      let totalRevenue = 0
      sessions.forEach((s: any) => {
        if (typeof s.fee === "number") totalRevenue += s.fee
      })
      setRevenue(totalRevenue)

      // Monthly stats: count vehicles per month
      const months: { [key: string]: number } = {}
      sessions.forEach((s: any) => {
        if (!s.time_in) return
        const date = new Date(s.time_in)
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`
        months[key] = (months[key] || 0) + 1
      })
      // Get last 12 months
      const now = new Date()
      const stats: any[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        stats.push({
          name: `T${d.getMonth() + 1}`,
          count: months[key] || 0,
        })
      }
      setMonthlyStats(stats)
      setLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div className="space-y-6 px-2 md:px-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">Tổng quan hệ thống</h1>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng người dùng</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : userCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Xe đã quản lý</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : vehicleCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Doanh thu</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : (revenue ? `${revenue.toLocaleString()}₫` : "0₫")}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vehicles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vehicles">Xe ra vào theo tháng</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Thống kê xe ra vào theo tháng</CardTitle>
              <CardDescription>Số lượng xe ra vào trong 12 tháng qua</CardDescription>
            </CardHeader>
            <CardContent className="h-72 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyStats}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
