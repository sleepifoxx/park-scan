"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getParkingSession } from "@/api/api_backend";

interface DetectionBox {
    plate: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

interface PlateInfo {
    plate: string;
    boxes: DetectionBox[];
}

const API_BASE_URL = "http://localhost:8001";
const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + "/ws/stream";

export default function UserPage() {
    const [plateInfo, setPlateInfo] = useState<PlateInfo>({ plate: "No plate detected", boxes: [] });
    const [showServerFeed, setShowServerFeed] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState("Disconnected");
    const [isLoading, setIsLoading] = useState(true);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [autoCheckResult, setAutoCheckResult] = useState<any>(null);
    const [lastCheckedPlate, setLastCheckedPlate] = useState<string>("");
    const [paused, setPaused] = useState(false);
    const [wsActive, setWsActive] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Poll server for latest plate regardless of feed
    useEffect(() => {
        let mounted = true;
        const fetchPlate = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/get_plate`);
                if (res.ok) {
                    const data = await res.json();
                    if (!mounted) return;
                    setPlateInfo(data);
                    setIsLoading(false);

                    // Only call getParkingSession if plate changed and is valid
                    if (
                        data.plate &&
                        data.plate !== "No plate detected" &&
                        data.plate !== lastCheckedPlate
                    ) {
                        setLastCheckedPlate(data.plate);
                        const result = await getParkingSession(data.plate);
                        if (result && result.status === "success") {
                            setAutoCheckResult(result.session);
                        } else {
                            setAutoCheckResult(null);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchPlate();
        const interval = setInterval(fetchPlate, 2000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [lastCheckedPlate]);

    // Setup WebSocket + Camera ONCE or when wsActive changes
    useEffect(() => {
        if (!wsActive) return;

        // Open WebSocket
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnectionStatus("Connected");
            setCameraError(null);
            startWebcam();
            heartbeatRef.current = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send('heartbeat');
            }, 30000);
        };

        ws.onmessage = evt => {
            try {
                const data = JSON.parse(evt.data);
                if (data.status === 'no_active_feed') {
                    setCameraError('No active server feed');
                } else if (data.plate) {
                    setPlateInfo({ plate: data.plate, boxes: data.boxes || [] });
                }
            } catch { }
        };

        ws.onclose = e => {
            setConnectionStatus("Disconnected");
            // Retry connection
            if (e.code !== 1000 && wsActive) {
                retryTimeoutRef.current = setTimeout(() => {
                    // reopen
                    const newWs = new WebSocket(WS_URL);
                    wsRef.current = newWs;
                }, 3000);
            }
        };

        ws.onerror = e => {
            console.error(e);
            setConnectionStatus("Error");
        };

        return () => {
            // cleanup on unmount
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            if (wsRef.current) wsRef.current.close();
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
        };
    }, [wsActive]);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                sendFrames();
            }
        } catch (e) {
            console.error(e);
            setCameraError("Camera access denied or unavailable");
            retryTimeoutRef.current = setTimeout(() => {
                startWebcam();
            }, 5000);
        }
    };

    const sendFrames = () => {
        const ws = wsRef.current;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!ws || !video || !canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const loop = () => {
            if (paused) {
                setTimeout(loop, 200);
                return;
            }
            if (ws.readyState === WebSocket.OPEN && video.videoWidth) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ws.send(canvas.toDataURL('image/jpeg', 0.7));
                setCameraError(null);
            }
            if (ws.readyState === WebSocket.OPEN) setTimeout(loop, 40);
        };
        loop();
    };

    // Nút tạm dừng/tiếp tục nhận diện
    const handlePauseToggle = () => {
        if (!paused) {
            // Tạm dừng: ngắt websocket và dừng gửi frame
            setPaused(true);
            setWsActive(false);
            if (wsRef.current) wsRef.current.close();
        } else {
            // Tiếp tục: kết nối lại websocket
            setPaused(false);
            setWsActive(true);
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Camera</CardTitle>
                            <span className={`${connectionStatus === 'Connected' ? 'text-green-500' : 'text-red-500'} text-sm`}>
                                {connectionStatus}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Bỏ toggle, chỉ còn button chuyển view và tạm dừng */}
                        {cameraError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded">
                            <p className="font-semibold">Error: {cameraError}</p>
                        </div>}
                        <div className="video-container relative">
                            <div className={showServerFeed ? "hidden" : "block"}>
                                <video ref={videoRef} className="w-full h-auto border rounded mb-2" autoPlay muted playsInline />
                            </div>
                            <div className={showServerFeed ? "block" : "hidden"}>
                                <img
                                    src={`${API_BASE_URL}/video_feed`}
                                    alt="Server Feed"
                                    className="w-full h-auto border rounded"
                                />
                            </div>
                            <canvas ref={canvasRef} width={640} height={480} className="hidden" />
                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                {showServerFeed ? "Luồng server" : "Camera trực tiếp"}
                            </div>
                        </div>
                        {/* Button group dưới video */}
                        <div className="flex flex-col md:flex-row gap-3 mt-6 justify-center">
                            <button
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-150
                                    ${showServerFeed
                                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                                        : "bg-gray-200 hover:bg-gray-300 text-gray-800 border border-gray-400"}
                                `}
                                onClick={() => setShowServerFeed(s => !s)}
                            >
                                {showServerFeed ? "Chuyển sang camera trực tiếp" : "Chuyển sang luồng server"}
                            </button>
                            <button
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-150
                                    ${paused
                                        ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                                        : "bg-green-600 hover:bg-green-700 text-white"}
                                `}
                                onClick={handlePauseToggle}
                            >
                                {paused ? "Tiếp tục nhận diện" : "Tạm dừng nhận diện"}
                            </button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Thông tin biển số</CardTitle></CardHeader>
                    <CardContent>
                        <div className="plate-display p-6 border rounded bg-gray-50 text-center mb-4">
                            {isLoading ? <p>Loading...</p> : <h3 className="text-4xl font-bold">{plateInfo.plate}</h3>}
                        </div>
                        {/* Show parking session result */}
                        {autoCheckResult ? (
                            <div className="mt-4 p-4 rounded border bg-blue-50">
                                <h4 className="font-semibold mb-2">
                                    {autoCheckResult.status === "active" ? "Xe vào bãi" : "Xe ra khỏi bãi"}
                                </h4>
                                <div className="mb-2">
                                    <span className="font-semibold">Biển số:</span> {autoCheckResult.license_plate}
                                </div>
                                <div className="mb-2">
                                    <span className="font-semibold">Loại xe:</span> {autoCheckResult.vehicle_type}
                                </div>
                                <div className="mb-2">
                                    <span className="font-semibold">Giờ vào:</span> {autoCheckResult.time_in ? new Date(autoCheckResult.time_in).toLocaleString() : "-"}
                                </div>
                                {autoCheckResult.time_out && (
                                    <div className="mb-2">
                                        <span className="font-semibold">Giờ ra:</span> {new Date(autoCheckResult.time_out).toLocaleString()}
                                    </div>
                                )}
                                {typeof autoCheckResult.fee === "number" && !isNaN(autoCheckResult.fee) && (
                                    <div className="mb-2">
                                        <span className="font-semibold">Số tiền:</span> {autoCheckResult.fee.toLocaleString(undefined, { maximumFractionDigits: 0 })} VNĐ
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}