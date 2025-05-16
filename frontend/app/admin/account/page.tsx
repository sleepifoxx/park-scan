"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/auth-context"
import { User, Lock, Save, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import * as api from "@/api/api_backend"
import Cookies from "js-cookie"

export default function AdminAccountPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    role: "",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [error, setError] = useState<string | null>(null)

  // Get user from cookies
  useEffect(() => {
    const fetchProfile = async () => {
      let username = ""
      const userStr = Cookies.get("user")
      const userObj = JSON.parse(userStr)
      if (userObj) {
        username = userObj.username
      }
      if (!username) return
      const res = await api.getUserInfo(username)
      if (res.status === "success" && res.user) {
        setProfileData({
          username: res.user.username,
          email: res.user.email,
          role: res.user.role,
        })
      }
    }
    fetchProfile()
  }, [user])

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

  const changePassword = async () => {
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

    const isOldPassCorrect = await api.login(
      profileData.username,
      passwordData.currentPassword
    )
    if (isOldPassCorrect.status !== "success") {
      setError("Mật khẩu hiện tại không chính xác")
      return
    }

    // Call API to change password
    const res = await api.modifyUserInfo(profileData.username, {
      password: passwordData.newPassword,
    })
    if (res.status === "success") {
      alert("Đổi mật khẩu thành công")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } else {
      setError(res.message || "Đổi mật khẩu thất bại")
    }
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
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Hồ Sơ</CardTitle>
              <CardDescription>Thông tin tài khoản của bạn</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Tên đăng nhập</Label>
                  <Input id="username" value={profileData.username} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profileData.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Vai trò</Label>
                  <Input id="role" value={profileData.role === "admin" ? "Quản trị viên" : "Người dùng"} disabled />
                </div>
              </div>
            </CardContent>
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
      </Tabs>
    </div>
  )
}
