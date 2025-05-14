"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Search, Download, AlertCircle, Info } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { useToast } from "@/components/ui/use-toast"

type LogEntry = {
  id: string
  timestamp: string
  action: string
  user: string
  details: string
  level: "info" | "warning" | "error"
  licensePlate?: string
}

export default function LogsPage() {
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState("")
  const [logLevel, setLogLevel] = useState<string>("all")

  // Mock log data
  const logs: LogEntry[] = [
    {
      id: "1",
      timestamp: "2025-05-12 08:30:15",
      action: "Đăng nhập",
      user: "admin@example.com",
      details: "Đăng nhập thành công",
      level: "info",
    },
    {
      id: "2",
      timestamp: "2025-05-12 09:15:30",
      action: "Nhận diện biển số",
      user: "user@example.com",
      details: "Nhận diện biển số xe thành công",
      level: "info",
      licensePlate: "51F-123.45",
    },
    {
      id: "3",
      timestamp: "2025-05-12 10:45:22",
      action: "Thanh toán",
      user: "user@example.com",
      details: "Thanh toán và xuất bãi thành công",
      level: "info",
      licensePlate: "51F-123.45",
    },
    {
      id: "4",
      timestamp: "2025-05-12 11:20:18",
      action: "Cập nhật phí dịch vụ",
      user: "admin@example.com",
      details: "Cập nhật phí dịch vụ cho xe máy",
      level: "warning",
    },
    {
      id: "5",
      timestamp: "2025-05-12 13:05:40",
      action: "Lỗi nhận diện",
      user: "user@example.com",
      details: "Không thể nhận diện biển số xe",
      level: "error",
    },
  ]

  // Filter logs based on search, date, and level
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.licensePlate && log.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesDate = !date || log.timestamp.startsWith(format(date, "yyyy-MM-dd"))

    const matchesLevel = logLevel === "all" || log.level === logLevel

    return matchesSearch && matchesDate && matchesLevel
  })

  const exportLogs = () => {
    // In a real app, this would generate and download a CSV/Excel file
    toast({
      title: "Xuất nhật ký thành công",
      description: "Nhật ký hệ thống đã được xuất thành công",
    })
  }

  const getLevelBadge = (level: "info" | "warning" | "error") => {
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
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="mr-1 h-3 w-3" />
            Lỗi
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Nhật Ký Hệ Thống</h1>
        <Button onClick={exportLogs}>
          <Download className="mr-2 h-4 w-4" />
          Xuất Nhật Ký
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ Lọc</CardTitle>
          <CardDescription>Lọc nhật ký theo thời gian, loại và từ khóa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Tìm kiếm..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal md:w-[240px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={vi} />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Loại nhật ký" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="info">Thông tin</SelectItem>
                  <SelectItem value="warning">Cảnh báo</SelectItem>
                  <SelectItem value="error">Lỗi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {date && (
              <div>
                <Button variant="ghost" onClick={() => setDate(undefined)} size="icon">
                  <span className="sr-only">Xóa ngày</span>✕
                </Button>
              </div>
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
                <TableHead>Người dùng</TableHead>
                <TableHead>Chi tiết</TableHead>
                <TableHead>Mức độ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Không tìm thấy nhật ký nào
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.user}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  )
}
