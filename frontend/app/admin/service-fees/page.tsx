"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { CreditCard, Save, Clock, Users, Calendar } from "lucide-react"
import * as api from "@/api/api_backend"

type FeeStructure = {
  id: number
  vehicleType: string
  hourlyRate: number
  maxCapacity: number
  createdAt: string
  updatedAt: string
}

function getVehicleTypeLabel(type: string) {
  if (type === "car") return "Ô tô"
  if (type === "motorcycle") return "Xe máy"
  return type
}

export default function ServiceFeesPage() {
  const { toast } = useToast()
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null)

  // Fetch fee structures from API
  const fetchFees = async () => {
    const res = await api.getParkingConfig()
    if (res.status === "success" && Array.isArray(res.config)) {
      setFeeStructures(
        res.config.map((item: any) => ({
          id: item.id,
          vehicleType: item.vehicle_type,
          hourlyRate: item.price_per_hour,
          maxCapacity: item.max_capacity,
          createdAt: item.created_at || "",
          updatedAt: item.updated_at || "",
        })),
      )
    } else {
      setFeeStructures([])
    }
  }

  useEffect(() => {
    fetchFees()
  }, [])

  const handleEditFee = (fee: FeeStructure) => {
    setEditingFee({ ...fee })
  }

  const handleSaveFee = async () => {
    if (!editingFee) return
    const res = await api.updateParkingConfig(editingFee.id, {
      // vehicle_type: editingFee.vehicleType, // not editable
      max_capacity: editingFee.maxCapacity,
      price_per_hour: editingFee.hourlyRate,
    })
    if (res.status === "success") {
      toast({
        title: "Lưu thành công",
        description: `Đã cập nhật phí dịch vụ cho ${getVehicleTypeLabel(editingFee.vehicleType)}`,
      })
      setEditingFee(null)
      fetchFees()
    } else {
      toast({
        title: "Lỗi",
        description: res.message || "Không thể cập nhật phí dịch vụ",
        variant: "destructive",
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingFee(null)
  }

  const handleInputChange = (field: keyof FeeStructure, value: string) => {
    if (!editingFee) return

    if (field === "hourlyRate" || field === "maxCapacity") {
      setEditingFee({
        ...editingFee,
        [field]: Number.parseInt(value) || 0,
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
                  <TableHead className="text-right">Sức chứa tối đa</TableHead>
                  <TableHead className="text-right">Tạo lúc</TableHead>
                  <TableHead className="text-right">Cập nhật lúc</TableHead>
                  <TableHead className="text-right">Thao Tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{getVehicleTypeLabel(fee.vehicleType)}</TableCell>
                    <TableCell className="text-right">{fee.hourlyRate.toLocaleString("vi-VN")}</TableCell>
                    <TableCell className="text-right">{fee.maxCapacity}</TableCell>
                    <TableCell className="text-right">{fee.createdAt ? new Date(fee.createdAt).toLocaleString("vi-VN") : ""}</TableCell>
                    <TableCell className="text-right">{fee.updatedAt ? new Date(fee.updatedAt).toLocaleString("vi-VN") : ""}</TableCell>
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
              <CardDescription>Cập nhật thông tin phí cho {getVehicleTypeLabel(editingFee.vehicleType)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Loại Phương Tiện</Label>
                <Input
                  id="vehicleType"
                  value={getVehicleTypeLabel(editingFee.vehicleType)}
                  disabled
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
                <Label htmlFor="maxCapacity" className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Sức chứa tối đa
                </Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  value={editingFee.maxCapacity}
                  onChange={(e) => handleInputChange("maxCapacity", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="createdAt">Tạo lúc</Label>
                <Input
                  id="createdAt"
                  value={editingFee.createdAt ? new Date(editingFee.createdAt).toLocaleString("vi-VN") : ""}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="updatedAt">Cập nhật lúc</Label>
                <Input
                  id="updatedAt"
                  value={editingFee.updatedAt ? new Date(editingFee.updatedAt).toLocaleString("vi-VN") : ""}
                  disabled
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
