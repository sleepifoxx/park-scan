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

// API endpoint
const API_URL = 'http://localhost:8000';

// Types for API responses
type PlateBox = {
  x: number
  y: number
  w: number
  h: number
  plate: string
}

type PlateResponse = {
  plate: string
  boxes: PlateBox[]
}

// Vehicle record type
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
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [plateData, setPlateData] = useState<PlateResponse>({ plate: 'No plate detected', boxes: [] })
  const [plateHistory, setPlateHistory] = useState<string[]>([])

  // Vehicle records state
  const [vehicleRecords, setVehicleRecords] = useState<VehicleRecord[]>([])

  // Stream URL for live video feed
  const streamUrl = `${API_URL}/video_feed`;

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  // Poll for license plate data from API
  useEffect(() => {
    if (!user) return;

    const fetchPlateData = async () => {
      try {
        const response = await fetch(`${API_URL}/get_plate`);
        if (!response.ok) {
          return;
        }

        const data = await response.json() as PlateResponse;
        setPlateData(data);

        // If a valid plate is detected, process it
        if (data.plate && data.plate !== 'No plate detected' && data.plate !== "unknown") {
          if (data.plate !== recognizedPlate) {
            setRecognizedPlate(data.plate);
            // Create a simple visual representation of the detected plate
            processDetectedPlate(data.plate);
          }

          // Update plate history with unique plates
          setPlateHistory(prev => {
            if (!prev.includes(data.plate)) {
              // Keep the history to 10 entries max
              const newHistory = [...prev, data.plate];
              return newHistory.slice(Math.max(0, newHistory.length - 10));
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error fetching license plate data:', error);
      }
    };

    // Poll every 2 seconds
    const intervalId = setInterval(fetchPlateData, 2000);
    return () => clearInterval(intervalId);
  }, [user, recognizedPlate]);

  // Process frames manually when requested
  const captureAndProcess = async () => {
    if (!canvasRef.current || isProcessing) return;

    setIsProcessing(true);

    try {
      const video = document.getElementById('videoStream') as HTMLImageElement;
      if (!video) {
        setIsProcessing(false);
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Set canvas dimensions to match video
      canvas.width = video.naturalWidth || 640;
      canvas.height = video.naturalHeight || 480;

      // Draw the current video frame to canvas
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setIsProcessing(false);
            return;
          }

          // Create form data with the image
          const formData = new FormData();
          formData.append('file', blob, 'frame.jpg');

          // Send the frame to the API
          try {
            await fetch(`${API_URL}/upload_frame`, {
              method: 'POST',
              body: formData,
            });

            // The API processes the frame but doesn't return it
            // We'll get the results in the next polling cycle
            setTimeout(() => {
              setIsProcessing(false);
            }, 500);
          } catch (error) {
            console.error('Error sending frame to API:', error);
            toast({
              variant: "destructive",
              title: "Lỗi API",
              description: "Không thể kết nối đến máy chủ nhận diện biển số.",
            });
            setIsProcessing(false);
          }
        }, 'image/jpeg', 0.8);
      } else {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      setIsProcessing(false);
    }
  };

  const processDetectedPlate = (plate: string) => {
    // Create a new vehicle record
    const currentTime = new Date();
    const timeString = currentTime.toISOString().replace("T", " ").substring(0, 19);

    // Check if this is an exit for an existing vehicle
    const existingVehicleIndex = vehicleRecords.findIndex(
      (v) => v.licensePlate === plate && v.status === "in"
    );

    if (existingVehicleIndex >= 0) {
      // This is a vehicle exiting
      const exitTime = currentTime.toISOString().replace("T", " ").substring(0, 19);

      // Calculate fee based on time difference
      const entryDate = new Date(vehicleRecords[existingVehicleIndex].entryTime);
      const hoursDiff = (currentTime.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
      const fee = Math.ceil(hoursDiff * 25000); // 25,000 VND per hour

      setVehicleRecords((prev) => {
        const updated = [...prev];
        updated[existingVehicleIndex] = {
          ...updated[existingVehicleIndex],
          exitTime,
          fee,
          status: "out",
        };
        return updated;
      });

      toast({
        title: "Xe rời khỏi bãi",
        description: `Xe biển số ${plate} đã được ghi nhận xuất bãi`,
      });
    } else {
      // Check if this plate is already registered
      const existingRecord = vehicleRecords.find(
        (v) => v.licensePlate === plate && v.status === "out"
      );

      if (!existingRecord) {
        // This is a new vehicle entering
        const newVehicle: VehicleRecord = {
          licensePlate: plate,
          entryTime: timeString,
          exitTime: null,
          fee: null,
          status: "in",
          croppedImageUrl: `/placeholder.svg?text=${plate}`, // Since we don't have the actual image
        };

        setActiveVehicle(newVehicle);
        setVehicleRecords((prev) => [newVehicle, ...prev]);

        toast({
          title: "Nhận diện thành công",
          description: `Đã nhận diện biển số: ${plate}`,
        });
      }
    }
  };

  const handleCheckout = (licensePlate: string) => {
    setVehicleRecords((prev) =>
      prev.map((record) => {
        if (record.licensePlate === licensePlate && record.status === "in") {
          const exitTime = new Date().toISOString().replace("T", " ").substring(0, 19);
          // Calculate fee based on time difference
          const entryDate = new Date(record.entryTime);
          const exitDate = new Date();
          const hoursDiff = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60);
          const fee = Math.ceil(hoursDiff * 25000); // 25,000 VND per hour

          return {
            ...record,
            exitTime,
            fee,
            status: "out" as const,
          };
        }
        return record;
      }),
    );

    toast({
      title: "Thanh toán thành công",
      description: `Xe biển số ${licensePlate} đã được thanh toán và xuất bãi`,
    });
  };

  const generateInvoice = (record: VehicleRecord) => {
    toast({
      title: "Đang xuất hóa đơn",
      description: `Hóa đơn cho xe biển số ${record.licensePlate} đang được tạo`,
    });
    // In a real app, this would generate and download a PDF invoice
  };

  const handleManualCapture = () => {
    captureAndProcess();
  };

  if (!user) {
    return null; // Don't render anything until we check authentication
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Hệ Thống Quản Lý Bãi Xe</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Camera Section with Stream */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="mr-2 h-5 w-5" />
                Camera Nhận Diện (Video 10fps)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  {/* Using the streaming endpoint directly */}
                  <img
                    id="videoStream"
                    src={streamUrl}
                    className="w-full h-full object-cover"
                    alt="Video feed"
                    onError={() => {
                      toast({
                        variant: "destructive",
                        title: "Lỗi stream",
                        description: "Không thể kết nối đến camera. Vui lòng kiểm tra kết nối.",
                      });
                    }}
                  />

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

                {/* Current recognized plate display */}
                <div className="mt-4 p-4 border rounded-md">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">Biển số nhận diện:</p>
                    <Badge variant={plateData.plate !== 'No plate detected' ? 'default' : 'outline'}>
                      {plateData.plate}
                    </Badge>
                  </div>

                  {plateData.boxes && plateData.boxes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Vị trí: X:{plateData.boxes[0].x}, Y:{plateData.boxes[0].y}, W:{plateData.boxes[0].w}, H:{plateData.boxes[0].h}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-4">
                  <Button onClick={handleManualCapture} disabled={isProcessing}>
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
                    <div className="aspect-[2/1] bg-muted rounded-md border flex items-center justify-center">
                      <p className="text-2xl font-bold">{activeVehicle.licensePlate}</p>
                    </div>
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
                        <Button onClick={() => generateInvoice(activeVehicle)}>
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

          {/* Plate History */}
          {plateHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lịch Sử Biển Số</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {plateHistory.map((plate, index) => (
                    <Badge key={index} variant="secondary">
                      {plate}
                    </Badge>
                  ))}
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
                      .map((record, idx) => (
                        <div key={`in-${idx}`} className="border rounded-lg p-4 space-y-2">
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
                      .map((record, idx) => (
                        <div key={`out-${idx}`} className="border rounded-lg p-4 space-y-2">
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