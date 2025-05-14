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

// Define API URL - update this to your actual backend URL
const API_URL = "http://localhost:8000"

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
  const wsRef = useRef<WebSocket | null>(null)
  const frameInterval = useRef<NodeJS.Timeout | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recognizedPlate, setRecognizedPlate] = useState<string | null>(null)
  const [activeVehicle, setActiveVehicle] = useState<VehicleRecord | null>(null)
  const [streamMode, setStreamMode] = useState<"local" | "server">("local")
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([])

  // Connection check timer
  const connectionCheckTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  useEffect(() => {
    // Start camera automatically when component mounts
    if (user) {
      // Increase delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        console.log("Attempting to start camera after delay");
        if (videoRef.current) {
          startCamera();
        } else {
          console.error("Video reference not found after initial delay, will retry");
          // Add another retry with a longer delay
          const retryTimer = setTimeout(() => {
            console.log("Retrying camera start");
            if (videoRef.current) {
              startCamera();
            } else {
              console.error("Video reference still not found after retry");
              toast({
                variant: "destructive",
                title: "Lỗi camera",
                description: "Không thể khởi tạo kết nối camera. Vui lòng tải lại trang.",
              });
            }
          }, 1000);
          return () => clearTimeout(retryTimer);
        }
      }, 800); // Increased from 500ms to 800ms

      return () => clearTimeout(timer);
    }

    // Set up periodic plate fetching
    const plateCheckInterval = setInterval(fetchLatestPlate, 2000)

    return () => {
      // Clean up on component unmount
      cleanupResources()
      clearInterval(plateCheckInterval)
    }
  }, [user])

  // Clean up function
  const cleanupResources = () => {
    // Stop WebSocket connection
    if (wsRef.current && isConnected) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop camera stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    // Clear frame sending interval
    if (frameInterval.current) {
      clearInterval(frameInterval.current)
      frameInterval.current = null
    }

    // Clear connection check timer
    if (connectionCheckTimerRef.current) {
      clearInterval(connectionCheckTimerRef.current)
      connectionCheckTimerRef.current = null
    }

    setIsCameraActive(false)
    setIsConnected(false)
  }

  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(`ws://${API_URL.replace(/^https?:\/\//, '')}/ws/stream`)

      ws.onopen = () => {
        console.log("WebSocket connected")
        setIsConnected(true)
        toast({
          title: "Kết nối thành công",
          description: "Đã kết nối tới máy chủ nhận diện biển số",
        })
      }

      ws.onclose = () => {
        console.log("WebSocket disconnected")
        setIsConnected(false)

        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (isCameraActive) {
            connectWebSocket()
          }
        }, 3000)
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        toast({
          variant: "destructive",
          title: "Lỗi kết nối",
          description: "Không thể kết nối đến máy chủ xử lý biển số",
        })
        setIsConnected(false)
      }

      wsRef.current = ws

      // Start connection check timer
      if (connectionCheckTimerRef.current) {
        clearInterval(connectionCheckTimerRef.current)
      }

      connectionCheckTimerRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setIsConnected(false)
        }
      }, 5000)
    } catch (error) {
      console.error("Error creating WebSocket:", error)
      setIsConnected(false)
    }
  }

  // Start the camera
  const startCamera = async () => {
    try {
      console.log("StartCamera called, videoRef exists:", !!videoRef.current);

      // Safety check - if somehow we got here without a video reference
      if (!videoRef.current) {
        console.error("Video reference is null in startCamera");
        toast({
          variant: "destructive",
          title: "Lỗi camera",
          description: "Không thể tìm thấy thẻ video. Vui lòng tải lại trang.",
        });
        return; // Exit function instead of throwing
      }

      // First, clean up any existing streams
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      console.log("Requesting camera access...")
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })

      if (videoRef.current) {
        console.log("Setting video stream to video element...")
        // Set the stream to the video element
        videoRef.current.srcObject = stream

        // Force the video to play immediately
        try {
          await videoRef.current.play()
          console.log("Video playback started successfully")
          setIsCameraActive(true)

          // Connect to WebSocket after camera is confirmed working
          connectWebSocket()

          // Start sending frames after video is playing
          startSendingFrames()
        } catch (err) {
          console.error("Error playing video:", err)
          toast({
            variant: "destructive",
            title: "Lỗi phát video",
            description: "Không thể phát video từ camera. Vui lòng thử lại.",
          })
        }
      } else {
        throw new Error("Video reference not found")
      }
    } catch (error) {
      console.error("Error in startCamera:", error)
      toast({
        variant: "destructive",
        title: "Lỗi camera",
        description: "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.",
      })
    }
  }

  // Restart the camera
  const restartCamera = async () => {
    console.log("Restarting camera...")
    cleanupResources()
    // Add a small delay before restarting
    setTimeout(() => {
      startCamera()
    }, 500)
  }

  // Start camera in background (for server mode)
  const startBackgroundCamera = async () => {
    try {
      console.log("Starting camera in background mode...")

      // Safety check for videoRef
      if (!videoRef.current) {
        console.error("Video reference is null in startBackgroundCamera");
        toast({
          variant: "destructive",
          title: "Lỗi camera",
          description: "Không thể tìm thấy thẻ video trong chế độ nền.",
        });
        return;
      }

      // First, clean up any existing streams
      if (videoRef.current.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream
        oldStream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 }, // Lower resolution for background mode
          height: { ideal: 480 }
        },
        audio: false
      })

      if (videoRef.current) {
        // Set the stream to the video element (but don't display it)
        videoRef.current.srcObject = stream

        try {
          await videoRef.current.play()
          console.log("Background video playback started")
          setIsCameraActive(true)

          // Connect to WebSocket
          connectWebSocket()

          // Start sending frames
          startSendingFrames()
        } catch (err) {
          console.error("Error playing background video:", err)
        }
      }
    } catch (error) {
      console.error("Error accessing background camera:", error)
    }
  }

  // Toggle stream mode between local camera and server stream
  const toggleStreamMode = () => {
    const newMode = streamMode === "local" ? "server" : "local"
    setStreamMode(newMode)
    if (newMode === "local") {
      if (!isCameraActive) restartCamera()
    } else {
      if (!isConnected) connectWebSocket()
      if (!isCameraActive) startBackgroundCamera()
    }
  }

  // Send frames to server via WebSocket
  const startSendingFrames = () => {
    // Clear any existing interval first
    if (frameInterval.current) {
      clearInterval(frameInterval.current)
      frameInterval.current = null
    }

    frameInterval.current = setInterval(() => {
      // We want to send frames regardless of streamMode now
      if (!isCameraActive || !isConnected ||
        !videoRef.current || !canvasRef.current ||
        !videoRef.current.srcObject) {
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      // Check if video is actually playing and has dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.log("Video not ready yet, dimensions:", video.videoWidth, video.videoHeight)
        return
      }

      // Draw video frame to canvas
      const ctx = canvas.getContext("2d")
      if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert canvas to base64 JPEG
        try {
          const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7)

          // Send to WebSocket if connected
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(imageDataUrl)
          }
        } catch (error) {
          console.error("Error converting/sending frame:", error)
        }
      }
    }, 333) // ~3 FPS to match FPS_YOLO setting in backend

    return () => {
      if (frameInterval.current) {
        clearInterval(frameInterval.current)
        frameInterval.current = null
      }
    }
  }

  // Fetch latest plate from API
  const fetchLatestPlate = async () => {
    try {
      const response = await fetch(`${API_URL}/get_plate`)
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const data = await response.json()

      if (data && data.plate && data.plate !== "unknown" && data.plate !== recognizedPlate) {
        // We have a new plate
        handleNewPlate(data.plate, data.boxes)
      }
    } catch (error) {
      console.error("Error fetching plate:", error)
    }
  }

  // Handle newly detected plate
  const handleNewPlate = (plate: string, boxes: any[]) => {
    setRecognizedPlate(plate)

    // Create a placeholder image URL (in real app, you'd use the cropped image from boxes)
    let croppedImageUrl = "/placeholder.svg?height=150&width=300"

    // Create a new vehicle record
    const currentTime = new Date()
    const timeString = currentTime.toISOString().replace("T", " ").substring(0, 19)

    // Check if this plate is already in the system as "in"
    const existingActiveVehicle = vehicleRecords.find(
      record => record.licensePlate === plate && record.status === "in"
    )

    if (!existingActiveVehicle) {
      // New vehicle entering
      const newVehicle: VehicleRecord = {
        licensePlate: plate,
        entryTime: timeString,
        exitTime: null,
        fee: null,
        status: "in",
        croppedImageUrl: croppedImageUrl,
      }

      setActiveVehicle(newVehicle)
      setVehicleRecords(prev => [newVehicle, ...prev])

      toast({
        title: "Nhận diện thành công",
        description: `Đã nhận diện biển số: ${plate}`,
      })
    } else {
      // Already in system, just update active vehicle
      setActiveVehicle(existingActiveVehicle)
    }
  }

  // Manual capture for testing
  const handleManualCapture = () => {
    setIsProcessing(true)

    setTimeout(() => {
      fetchLatestPlate()
      setIsProcessing(false)
    }, 2000)
  }

  // Handle vehicle checkout
  const handleCheckout = (licensePlate: string) => {
    setVehicleRecords((prev) =>
      prev.map((record) => {
        if (record.licensePlate === licensePlate && record.status === "in") {
          const exitTime = new Date().toISOString().replace("T", " ").substring(0, 19)
          // Calculate fee based on time difference
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

  // Generate invoice
  const generateInvoice = (record: VehicleRecord) => {
    toast({
      title: "Đang xuất hóa đơn",
      description: `Hóa đơn cho xe biển số ${record.licensePlate} đang được tạo`,
    })
    // In a real app, this would generate and download a PDF invoice
  }

  if (!user) {
    return null // Don't render anything until we check authentication
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Hệ Thống Quản Lý Bãi Xe</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Camera Section - Stream from server or local camera */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Camera className="mr-2 h-5 w-5" />
                  {streamMode === "local" ? "Camera Trực Tiếp" : "Luồng Video Từ Máy Chủ"}
                </div>
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Đã Kết Nối" : "Mất Kết Nối"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  {streamMode === "local" ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      key="server-video"
                      src={`${API_URL}/video_feed`}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      onError={() => {
                        toast({
                          variant: "destructive",
                          title: "Lỗi luồng máy chủ",
                          description: "Không thể tải luồng video từ máy chủ.",
                        })
                      }}
                    />
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
                    Khởi động lại kết nối
                  </Button>
                  <Button variant="outline" onClick={toggleStreamMode} disabled={isProcessing}>
                    <Camera className="mr-2 h-4 w-4" />
                    {streamMode === "local" ? "Xem từ máy chủ" : "Xem camera trực tiếp"}
                  </Button>
                  <Button onClick={handleManualCapture} disabled={isProcessing || !isConnected}>
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
        </div >
      </div >
    </div >
  )
}