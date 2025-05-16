"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Download, AlertCircle, Info, RefreshCw } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, isSameDay, parse } from "date-fns"
import { vi } from "date-fns/locale"
import { useToast } from "@/components/ui/use-toast"
import * as api from "@/api/api_backend"
import { Input } from "@/components/ui/input"

type LogEntry = {
  id: string
  timestamp: string
  action: string
  user: string
  details: string
  level: "info" | "warning"
  licensePlate?: string
}

const PAGE_SIZE = 50

export default function LogsPage() {
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [pendingDate, setPendingDate] = useState<Date | undefined>(undefined)
  const [logLevel, setLogLevel] = useState<string>("all")
  const [pendingLogLevel, setPendingLogLevel] = useState<string>("all")
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [dateInput, setDateInput] = useState<string>("")
  const [pendingDateInput, setPendingDateInput] = useState<string>("")

  // Fetch logs from API (parking sessions + parking config updates + user created_at)
  const fetchLogs = async () => {
    setLoading(true)
    // Get parking sessions (info)
    const sessionRes = await api.getAllParkingSessions()
    let sessionLogs: LogEntry[] = []
    if (sessionRes.status === "success" && Array.isArray(sessionRes.sessions)) {
      sessionLogs = sessionRes.sessions.map((s: any) => ({
        id: `session-${s.id}`,
        timestamp: s.time_in ? new Date(s.time_in).toISOString() : "",
        action: s.status === "closed" ? "Thanh toán & xuất bãi" : "Nhận diện biển số",
        user: s.license_plate || "",
        details:
          s.status === "closed"
            ? `Thanh toán và xuất bãi thành công${s.license_plate ? ` (Biển số: ${s.license_plate})` : ""}`
            : `Nhận diện biển số xe thành công${s.license_plate ? ` (Biển số: ${s.license_plate})` : ""}`,
        level: "info" as const,
        licensePlate: s.license_plate,
      }))
    }

    // Get parking config (warning)
    const configRes = await api.getParkingConfig()
    let configLogs: LogEntry[] = []
    if (configRes.status === "success" && Array.isArray(configRes.config)) {
      configLogs = configRes.config.flatMap((c: any) => {
        const logs: LogEntry[] = []
        if (c.created_at) {
          logs.push({
            id: `config-create-${c.id}`,
            timestamp: new Date(c.created_at).toISOString(),
            action: "Tạo cấu hình bãi đỗ",
            user: "",
            details: `Tạo cấu hình cho ${c.vehicle_type === "car" ? "Ô tô" : c.vehicle_type === "motorcycle" ? "Xe máy" : c.vehicle_type}`,
            level: "warning",
          })
        }
        if (c.updated_at && c.updated_at !== c.created_at) {
          logs.push({
            id: `config-update-${c.id}`,
            timestamp: new Date(c.updated_at).toISOString(),
            action: "Cập nhật phí dịch vụ",
            user: "",
            details: `Cập nhật phí dịch vụ cho ${c.vehicle_type === "car" ? "Ô tô" : c.vehicle_type === "motorcycle" ? "Xe máy" : c.vehicle_type}`,
            level: "warning",
          })
        }
        return logs
      })
    }

    // Get users (created_at as info)
    const usersRes = await api.getAllUsers()
    let userLogs: LogEntry[] = []
    if (usersRes.status === "success" && Array.isArray(usersRes.users)) {
      userLogs = usersRes.users
        .filter((u: any) => u.created_at)
        .map((u: any) => ({
          id: `user-create-${u.username}`,
          timestamp: new Date(u.created_at).toISOString(),
          action: "Tạo người dùng",
          user: u.username,
          details: `Tạo tài khoản cho ${u.username} (${u.email})`,
          level: "info" as const,
        }))
    }

    // Merge and sort all logs by timestamp desc
    const allLogs = [...sessionLogs, ...configLogs, ...userLogs].filter((l) => l.timestamp)
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setLogs(allLogs)
    setPage(1)
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  // Filter logs by date (dd/mm/yyyy) and level
  const filteredLogs = useMemo(() => {
    let filtered = logs
    if (dateInput) {
      // Parse dd/mm/yyyy
      const parsed = parse(dateInput, "dd/MM/yyyy", new Date())
      if (!isNaN(parsed.getTime())) {
        filtered = filtered.filter((log) => {
          const logDate = new Date(log.timestamp)
          return (
            logDate.getDate() === parsed.getDate() &&
            logDate.getMonth() === parsed.getMonth() &&
            logDate.getFullYear() === parsed.getFullYear()
          )
        })
      }
    }
    if (logLevel !== "all") {
      filtered = filtered.filter((log) => log.level === logLevel)
    }
    return filtered
  }, [logs, dateInput, logLevel])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE)
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Export logs as CSV
  const exportLogs = () => {
    // Prepare CSV headers
    const headers = ["Thời gian", "Hành động", "Chi tiết", "Mức độ"]
    // Use filteredLogs for export (all pages)
    const rows = filteredLogs.map((log) => [
      log.timestamp ? format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss") : "",
      log.action,
      log.details + (log.licensePlate ? ` (Biển số: ${log.licensePlate})` : ""),
      log.level === "info" ? "Thông tin" : "Cảnh báo",
    ])
    const csvContent =
      [headers, ...rows]
        .map((row) => row.map((field) => `"${(field ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "logs.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Xuất nhật ký thành công",
      description: "Nhật ký hệ thống đã được xuất thành công",
    })
  }

  const getLevelBadge = (level: "info" | "warning") => {
    switch (level) {
      case "info":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Info className="mr-1 h-3 w-3" />
            Thông tin
          </Badge>
        )
      case "warning":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            Cảnh báo
          </Badge>
        )
      default:
        return null
    }
  }

  // Confirm filter
  const handleConfirmFilter = () => {
    setDateInput(pendingDateInput)
    setLogLevel(pendingLogLevel)
    setPage(1)
  }

  // Refresh logs
  const handleRefresh = () => {
    fetchLogs()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Nhật Ký Hệ Thống</h1>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
          <Button onClick={exportLogs}>
            <Download className="mr-2 h-4 w-4" />
            Xuất Nhật Ký
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ Lọc</CardTitle>
          <CardDescription>Lọc nhật ký theo loại</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <Select value={pendingLogLevel} onValueChange={setPendingLogLevel}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Loại nhật ký" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="info">Thông tin</SelectItem>
                  <SelectItem value="warning">Cảnh báo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleConfirmFilter} className="md:ml-2">
              Xác nhận
            </Button>
            {pendingDateInput && (
              <Button variant="ghost" onClick={() => setPendingDateInput("")} size="icon">
                <span className="sr-only">Xóa ngày</span>✕
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Chi tiết</TableHead>
                <TableHead>Mức độ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Không tìm thấy nhật ký nào
                  </TableCell>
                </TableRow>
              ) : (
                pagedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {log.timestamp ? format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss") : ""}
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>
                      {log.details}
                      {log.licensePlate && (
                        <span className="ml-2 text-sm text-muted-foreground">(Biển số: {log.licensePlate})</span>
                      )}
                    </TableCell>
                    <TableCell>{getLevelBadge(log.level)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </Button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Trang sau
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}