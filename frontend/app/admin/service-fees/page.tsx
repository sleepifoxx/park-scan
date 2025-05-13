"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { CreditCard, Save, Clock, Calendar } from "lucide-react"

type FeeStructure = {
  id: string
  vehicleType: string
  hourlyRate: number
  dailyRate: number
  monthlyRate: number
  description: string
  lastUpdated: string
}

export default function ServiceFeesPage() {
  const { toast } = useToast()
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([
    {
      id: "1",
      vehicleType: "Xe máy",
      hourlyRate: 5000,
      dailyRate: 30000,
      monthlyRate: 500000,
      description: "Áp dụng cho tất cả các loại xe máy",
      lastUpdated: "2025-04-15",
    },
    {
      id: "2",
      vehicleType: "Ô tô 4-7 chỗ",
      hourlyRate: 25000,
      dailyRate: 150000,
      monthlyRate: 2500000,
      description: "Áp dụng cho xe ô tô 4-7 chỗ",
      lastUpdated: "2025-04-15",
    },
    {
      id: "3",
      vehicleType: "Ô tô > 7 chỗ",
      hourlyRate: 35000,
      dailyRate: 200000,
      monthlyRate: 3500000,
      description: "Áp dụng cho xe ô tô trên 7 chỗ",
      lastUpdated: "2025-04-15",
    },
  ])

  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null)

  const handleEditFee = (fee: FeeStructure) => {
    setEditingFee({ ...fee })
  }

  const handleSaveFee = () => {
    if (!editingFee) return

    setFeeStructures((prev) =>
      prev.map((fee) =>
        fee.id === editingFee.id ? { ...editingFee, lastUpdated: new Date().toISOString().split("T")[0] } : fee,
      ),
    )

    toast({
      title: "Lưu thành công",
      description: `Đã cập nhật phí dịch vụ cho ${editingFee.vehicleType}`,
    })

    setEditingFee(null)
  }

  const handleCancelEdit = () => {
    setEditingFee(null)
  }

  const handleInputChange = (field: keyof FeeStructure, value: string) => {
    if (!editingFee) return

    if (field === "hourlyRate" || field === "dailyRate" || field === "monthlyRate") {
      setEditingFee({
        ...editingFee,
        [field]: Number.parseInt(value) || 0,
      })
    } else {
      setEditingFee({
        ...editingFee,
        [field]: value,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Thiết Lập Phí Dịch Vụ</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Cấu Trúc Phí Hiện Tại
            </CardTitle>
            <CardDescription>Danh sách các loại phí dịch vụ theo loại phương tiện</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại Phương Tiện</TableHead>
                  <TableHead className="text-right">Phí Giờ (VNĐ)</TableHead>
                  <TableHead className="text-right">Phí Ngày (VNĐ)</TableHead>
                  <TableHead className="text-right">Phí Tháng (VNĐ)</TableHead>
                  <TableHead className="text-right">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.vehicleType}</TableCell>
                    <TableCell className="text-right">{fee.hourlyRate.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right">{fee.dailyRate.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right">{fee.monthlyRate.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditFee(fee)}>
                        Chỉnh sửa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {editingFee ? (
          <Card>
            <CardHeader>
              <CardTitle>Chỉnh Sửa Phí Dịch Vụ</CardTitle>
              <CardDescription>Cập nhật thông tin phí cho {editingFee.vehicleType}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Loại Phương Tiện</Label>
                <Input
                  id="vehicleType"
                  value={editingFee.vehicleType}
                  onChange={(e) => handleInputChange("vehicleType", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate" className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Phí Theo Giờ (VNĐ)
                </Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={editingFee.hourlyRate}
                  onChange={(e) => handleInputChange("hourlyRate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dailyRate" className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  Phí Theo Ngày (VNĐ)
                </Label>
                <Input
                  id="dailyRate"
                  type="number"
                  value={editingFee.dailyRate}
                  onChange={(e) => handleInputChange("dailyRate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyRate" className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  Phí Theo Tháng (VNĐ)
                </Label>
                <Input
                  id="monthlyRate"
                  type="number"
                  value={editingFee.monthlyRate}
                  onChange={(e) => handleInputChange("monthlyRate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô Tả</Label>
                <Input
                  id="description"
                  value={editingFee.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleCancelEdit}>
                Hủy
              </Button>
              <Button onClick={handleSaveFee}>
                <Save className="mr-2 h-4 w-4" />
                Lưu Thay Đổi
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Phí Dịch Vụ</CardTitle>
              <CardDescription>Chọn một loại phí từ bảng để chỉnh sửa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mb-4 opacity-20" />
                <p>Chọn một loại phí từ bảng bên trái để chỉnh sửa thông tin</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
