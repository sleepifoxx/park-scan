"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Camera, Download, Clock, CreditCard, Car, RefreshCw } from "lucide-react"

// Mock data for vehicle entry/exit
type VehicleRecord = {
  licensePlate: string
  entryTime: string
  exitTime: string | null
  fee: number | null
  status: "in" | "out"
  croppedImageUrl: string
}

export default function UserDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [recognizedPlate, setRecognizedPlate] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeVehicle, setActiveVehicle] = useState<VehicleRecord | null>(null)

  // Mock vehicle records
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([
    {
      licensePlate: "51F-123.45",
      entryTime: "2025-05-12 08:30:15",
      exitTime: "2025-05-12 10:45:22",
      fee: 50000,
      status: "out",
      croppedImageUrl: "/placeholder.svg?height=150&width=300",
    },
    {
      licensePlate: "59H-678.90",
      entryTime: "2025-05-12 09:15:30",
      exitTime: null,
      fee: null,
      status: "in",
      croppedImageUrl: "/placeholder.svg?height=150&width=300",
    },
  ])

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  useEffect(() => {
    // Start camera automatically when component mounts
    if (user) {
      startCamera()
    }

    return () => {
      // Clean up camera stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [user])

  // Simulate automatic license plate detection every 5 seconds
  useEffect(() => {
    if (!isCameraActive || isProcessing) return

    const interval = setInterval(() => {
      captureAndProcess()
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [isCameraActive, isProcessing])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsCameraActive(true)
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      toast({
        variant: "destructive",
        title: "Lỗi camera",
        description: "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.",
      })
    }
  }

  const restartCamera = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }
    await startCamera()
  }

  const captureAndProcess = () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return

    setIsProcessing(true)

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert canvas to image
      const imageDataUrl = canvas.toDataURL("image/jpeg")

      // Process the captured image
      processLicensePlate(imageDataUrl)
    }
  }

  const processLicensePlate = (imageUrl: string) => {
    // Simulate license plate recognition with a delay
    setTimeout(() => {
      // Mock recognition result
      const mockPlate = "51G-" + Math.floor(Math.random() * 900 + 100) + "." + Math.floor(Math.random() * 90 + 10)
      setRecognizedPlate(mockPlate)

      // Create a new vehicle record
      const currentTime = new Date()
      const timeString = currentTime.toISOString().replace("T", " ").substring(0, 19)

      const newVehicle: VehicleRecord = {
        licensePlate: mockPlate,
        entryTime: timeString,
        exitTime: null,
        fee: null,
        status: "in",
        croppedImageUrl: imageUrl,
      }

      setActiveVehicle(newVehicle)
      setVehicleRecords((prev) => [newVehicle, ...prev])
      setIsProcessing(false)

      toast({
        title: "Nhận diện thành công",
        description: `Đã nhận diện biển số: ${mockPlate}`,
      })
    }, 2000)
  }

  const handleCheckout = (licensePlate: string) => {
    setVehicleRecords((prev) =>
      prev.map((record) => {
        if (record.licensePlate === licensePlate && record.status === "in") {
          const exitTime = new Date().toISOString().replace("T", " ").substring(0, 19)
          // Calculate fee based on time difference (mock calculation)
          const entryDate = new Date(record.entryTime)
          const exitDate = new Date()
          const hoursDiff = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)
          const fee = Math.ceil(hoursDiff * 25000) // 25,000 VND per hour

          return {
            ...record,
            exitTime,
            fee,
            status: "out" as const,
          }
        }
        return record
      }),
    )

    toast({
      title: "Thanh toán thành công",
      description: `Xe biển số ${licensePlate} đã được thanh toán và xuất bãi`,
    })
  }

  const generateInvoice = (record: VehicleRecord) => {
    toast({
      title: "Đang xuất hóa đơn",
      description: `Hóa đơn cho xe biển số ${record.licensePlate} đang được tạo`,
    })
    // In a real app, this would generate and download a PDF invoice
  }

  const handleManualCapture = () => {
    captureAndProcess()
  }

  if (!user) {
    return null // Don't render anything until we check authentication
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Hệ Thống Quản Lý Bãi Xe</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Camera Section - Continuously Running */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="mr-2 h-5 w-5" />
                Camera Nhận Diện (Đang chạy liên tục)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  {isCameraActive ? (
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Camera className="h-16 w-16 mb-4 opacity-20" />
                      <p>Đang kết nối camera...</p>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                        <p>Đang xử lý...</p>
                      </div>
                    </div>
                  )}

                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={restartCamera} disabled={isProcessing}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Khởi động lại camera
                  </Button>
                  <Button onClick={handleManualCapture} disabled={isProcessing || !isCameraActive}>
                    <Camera className="mr-2 h-4 w-4" />
                    Nhận diện thủ công
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* License Plate Information */}
          {activeVehicle && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Car className="mr-2 h-5 w-5" />
                  Thông tin biển số xe
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="relative w-full max-w-xs">
                    <img
                      src={activeVehicle.croppedImageUrl || "/placeholder.svg"}
                      alt="Biển số xe"
                      className="w-full h-auto rounded-md border"
                    />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-sm text-muted-foreground">Biển số xe:</p>
                      <p className="text-3xl font-bold font-mono">{activeVehicle.licensePlate}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="text-sm">Thời gian vào: {activeVehicle.entryTime}</span>
                      </div>
                      {activeVehicle.exitTime && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">Thời gian ra: {activeVehicle.exitTime}</span>
                        </div>
                      )}
                      {activeVehicle.fee && (
                        <div className="flex items-center">
                          <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">Phí dịch vụ: {activeVehicle.fee.toLocaleString("vi-VN")} VNĐ</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {activeVehicle.status === "in" ? (
                        <Button onClick={() => handleCheckout(activeVehicle.licensePlate)}>
                          Thanh Toán & Xuất Bãi
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => generateInvoice(activeVehicle)}>
                          <Download className="mr-2 h-4 w-4" />
                          Xuất Hóa Đơn
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Vehicle Records */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Lịch Sử Xe Ra Vào</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="in">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="in">Xe Trong Bãi</TabsTrigger>
                  <TabsTrigger value="out">Xe Đã Ra</TabsTrigger>
                </TabsList>

                <TabsContent value="in" className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {vehicleRecords.filter((record) => record.status === "in").length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Không có xe trong bãi</p>
                  ) : (
                    vehicleRecords
                      .filter((record) => record.status === "in")
                      .map((record) => (
                        <div key={record.licensePlate} className="border rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="font-bold">{record.licensePlate}</p>
                            <Badge>Đang trong bãi</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Vào: {record.entryTime}</p>
                          <Button size="sm" className="w-full" onClick={() => handleCheckout(record.licensePlate)}>
                            Thanh Toán & Xuất Bãi
                          </Button>
                        </div>
                      ))
                  )}
                </TabsContent>

                <TabsContent value="out" className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {vehicleRecords.filter((record) => record.status === "out").length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Không có lịch sử xe ra</p>
                  ) : (
                    vehicleRecords
                      .filter((record) => record.status === "out")
                      .map((record) => (
                        <div key={record.licensePlate} className="border rounded-lg p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="font-bold">{record.licensePlate}</p>
                            <Badge variant="outline">Đã ra bãi</Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="text-muted-foreground">Vào: {record.entryTime}</p>
                            <p className="text-muted-foreground">Ra: {record.exitTime}</p>
                            <p>Phí: {record.fee?.toLocaleString("vi-VN")} VNĐ</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => generateInvoice(record)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Xuất Hóa Đơn
                          </Button>
                        </div>
                      ))
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
