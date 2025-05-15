"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const WS_URL = API_BASE_URL.replace(/^http/, 'ws') + "/ws/stream";

export default function UserPage() {
    const [plateInfo, setPlateInfo] = useState<PlateInfo>({ plate: "No plate detected", boxes: [] });
    const [showServerFeed, setShowServerFeed] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState("Disconnected");
    const [isLoading, setIsLoading] = useState(true);
    const [cameraError, setCameraError] = useState<string | null>(null);

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
    }, []);

    // Setup WebSocket + Camera ONCE
    useEffect(() => {
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
            if (e.code !== 1000) {
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
    }, []);

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
            if (ws.readyState === WebSocket.OPEN && video.videoWidth) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ws.send(canvas.toDataURL('image/jpeg', 0.7));
                setCameraError(null);
            }
            if (ws.readyState === WebSocket.OPEN) setTimeout(loop, 40);
        };
        loop();
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">License Plate Recognition</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Video Feed</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center mb-4 space-x-2">
                            <Switch
                                id="camera-mode"
                                checked={!showServerFeed}
                                onCheckedChange={() => setShowServerFeed(s => !s)}
                            />
                            <label htmlFor="camera-mode">
                                {showServerFeed ? "Show my camera" : "Show server view"}
                            </label>
                            <span className={`${connectionStatus === 'Connected' ? 'text-green-500' : 'text-red-500'} ml-4 text-sm`}>
                                WS: {connectionStatus}
                            </span>
                        </div>
                        {cameraError && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded">
                            <p className="font-semibold">Error: {cameraError}</p>
                        </div>}
                        <div className="video-container relative">
                            {/* Always keep video in DOM but toggle visibility */}
                            <div className={showServerFeed ? "hidden" : "block"}>
                                <video ref={videoRef} className="w-full h-auto border rounded mb-2" autoPlay muted playsInline />
                            </div>

                            {/* Always keep server feed in DOM but toggle visibility */}
                            <div className={showServerFeed ? "block" : "hidden"}>
                                <img
                                    src={`${API_BASE_URL}/video_feed`}
                                    alt="Server Feed"
                                    className="w-full h-auto border rounded"
                                />
                            </div>

                            {/* Canvas is always needed for video processing */}
                            <canvas ref={canvasRef} width={640} height={480} className="hidden" />

                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                {showServerFeed ? "Server Stream" : "Local Camera"}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Detected License Plate</CardTitle></CardHeader>
                    <CardContent>
                        <div className="plate-display p-6 border rounded bg-gray-50 text-center mb-4">
                            {isLoading ? <p>Loading...</p> : <h3 className="text-4xl font-bold">{plateInfo.plate}</h3>}
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold mb-2">Detection Details</h3>
                            {plateInfo.boxes.length ? (
                                plateInfo.boxes.map((b, i) => (
                                    <div key={i} className="p-3 bg-gray-100 rounded mb-2">
                                        <p><strong>Plate:</strong> {b.plate}</p>
                                        <p><strong>Box:</strong> x:{b.x}, y:{b.y}, w:{b.w}, h:{b.h}</p>
                                    </div>
                                ))
                            ) : <p className="text-gray-500">No detections yet.</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}