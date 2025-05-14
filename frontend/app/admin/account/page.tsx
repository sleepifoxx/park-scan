"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/context/auth-context"
import { User, Lock, Shield, Save, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function AdminAccountPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [profileData, setProfileData] = useState({
    name: "Admin User",
    email: "admin@example.com",
    phone: "0123456789",
    role: "admin",
    avatar: "/placeholder.svg?height=100&width=100",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [securityData, setSecurityData] = useState({
    twoFactorEnabled: false,
    notificationsEnabled: true,
    lastLogin: "2025-05-12 08:30:15",
    ipAddress: "192.168.1.1",
  })

  const [error, setError] = useState<string | null>(null)

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSecurityChange = (field: string, value: boolean) => {
    setSecurityData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveProfile = () => {
    toast({
      title: "Hồ sơ đã được cập nhật",
      description: "Thông tin hồ sơ của bạn đã được lưu thành công.",
    })
  }

  const changePassword = () => {
    setError(null)

    if (passwordData.currentPassword === "") {
      setError("Vui lòng nhập mật khẩu hiện tại")
      return
    }

    if (passwordData.newPassword === "") {
      setError("Vui lòng nhập mật khẩu mới")
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("Mật khẩu mới và xác nhận mật khẩu không khớp")
      return
    }

    // In a real app, this would call an API to change the password
    toast({
      title: "Mật khẩu đã được thay đổi",
      description: "Mật khẩu của bạn đã được cập nhật thành công.",
    })

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
  }

  const saveSecuritySettings = () => {
    toast({
      title: "Cài đặt bảo mật đã được cập nhật",
      description: "Cài đặt bảo mật của bạn đã được lưu thành công.",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tài Khoản Admin</h1>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Hồ Sơ
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center">
            <Lock className="mr-2 h-4 w-4" />
            Mật Khẩu
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Bảo Mật
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Hồ Sơ</CardTitle>
              <CardDescription>Quản lý thông tin cá nhân của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profileData.avatar || "/placeholder.svg"} alt={profileData.name} />
                    <AvatarFallback>{profileData.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" size="sm">
                    Thay đổi ảnh
                  </Button>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Họ tên</Label>
                      <Input
                        id="name"
                        value={profileData.name}
                        onChange={(e) => handleProfileChange("name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Số điện thoại</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => handleProfileChange("phone", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Vai trò</Label>
                      <Input id="role" value={profileData.role === "admin" ? "Quản trị viên" : "Người dùng"} disabled />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={saveProfile}>
                <Save className="mr-2 h-4 w-4" />
                Lưu Thay Đổi
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Thay Đổi Mật Khẩu</CardTitle>
              <CardDescription>Cập nhật mật khẩu của bạn để bảo mật tài khoản</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={changePassword}>
                <Lock className="mr-2 h-4 w-4" />
                Thay Đổi Mật Khẩu
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Cài Đặt Bảo Mật</CardTitle>
              <CardDescription>Quản lý các cài đặt bảo mật cho tài khoản của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Xác thực hai yếu tố</h3>
                    <p className="text-sm text-muted-foreground">Thêm một lớp bảo mật bổ sung cho tài khoản của bạn</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={securityData.twoFactorEnabled ? "default" : "outline"}
                      onClick={() => handleSecurityChange("twoFactorEnabled", !securityData.twoFactorEnabled)}
                    >
                      {securityData.twoFactorEnabled ? "Đã bật" : "Bật"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Thông báo đăng nhập</h3>
                    <p className="text-sm text-muted-foreground">
                      Nhận thông báo khi có đăng nhập mới vào tài khoản của bạn
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={securityData.notificationsEnabled ? "default" : "outline"}
                      onClick={() => handleSecurityChange("notificationsEnabled", !securityData.notificationsEnabled)}
                    >
                      {securityData.notificationsEnabled ? "Đã bật" : "Bật"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Thông tin đăng nhập gần đây</h3>
                <div className="rounded-md border p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Thời gian đăng nhập</p>
                      <p className="font-medium">{securityData.lastLogin}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Địa chỉ IP</p>
                      <p className="font-medium">{securityData.ipAddress}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={saveSecuritySettings}>
                <Save className="mr-2 h-4 w-4" />
                Lưu Cài Đặt
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
