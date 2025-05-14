"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function UserPage() {
    // State variables
    const [plateInfo, setPlateInfo] = useState({ plate: "No plate detected", boxes: [] });
    const [showServerFeed, setShowServerFeed] = useState(true); // Changed from useWebsocket to showServerFeed
    const [connectionStatus, setConnectionStatus] = useState("Disconnected");
    const [isLoading, setIsLoading] = useState(true);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // References
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Fetch plate information periodically (always active regardless of view mode)
    useEffect(() => {
        const fetchPlateInfo = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/get_plate`);
                if (response.ok) {
                    const data = await response.json();
                    setPlateInfo(data);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error fetching plate info:", error);
            }
        };

        fetchPlateInfo();
        const interval = setInterval(fetchPlateInfo, 2000);
        return () => clearInterval(interval);
    }, []);

    // Handle WebSocket connection and webcam streaming - now independent of view mode
    useEffect(() => {
        // Connect to WebSocket
        const connectWebSocket = () => {
            wsRef.current = new WebSocket(`ws://${API_BASE_URL.replace("http://", "")}/ws/stream`);

            wsRef.current.onopen = () => {
                setConnectionStatus("Connected");
                setCameraError(null);
                startWebcam();
            };

            wsRef.current.onclose = (event) => {
                setConnectionStatus("Disconnected");
                console.log("WebSocket closed:", event);

                // Try to reconnect after a delay if it was an abnormal closure
                if (event.code !== 1000 && event.code !== 1001) {
                    retryTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, 3000);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error("WebSocket error:", error);
                setConnectionStatus("Error connecting");
            };

            // Handle messages from server (could include status updates)
            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.status === "no_active_feed") {
                        setCameraError("No active camera feed detected on server");
                    } else if (data.plate) {
                        setPlateInfo({ plate: data.plate, boxes: data.boxes || [] });
                    }
                } catch (e) {
                    // Not JSON data, probably a pong or other message
                }
            };
        };

        // Initial WebSocket connection
        connectWebSocket();

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send("heartbeat");
            }
        }, 30000);

        return () => {
            clearInterval(heartbeatInterval);
            if (wsRef.current) {
                wsRef.current.close();
            }

            // Stop webcam
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach(track => track.stop());
            }

            // Clear any pending retry timeouts
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [API_BASE_URL]); // Only depends on API_BASE_URL, not on view mode

    // Function to start webcam and send frames
    const startWebcam = async () => {
        try {
            // Clear any previous error
            setCameraError(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    // Start sending frames once video is ready
                    if (videoRef.current) videoRef.current.play();
                    sendFrames();
                };
            }
        } catch (error) {
            console.error("Error accessing webcam:", error);
            setCameraError("Camera access denied or device not available");
            setConnectionStatus("Webcam access denied");

            // Set a timer to retry camera access
            retryTimeoutRef.current = setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    console.log("Retrying camera access...");
                    startWebcam();
                }
            }, 5000);
        }
    };

    // Function to send frames to the WebSocket
    const sendFrames = () => {
        if (!canvasRef.current || !videoRef.current || !wsRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let frameCount = 0;
        let lastErrorTime = 0;

        const sendFrame = () => {
            if (
                videoRef.current &&
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN &&
                videoRef.current.videoWidth > 0
            ) {
                try {
                    // Draw video frame to canvas
                    ctx.drawImage(
                        videoRef.current,
                        0, 0,
                        canvasRef.current!.width,
                        canvasRef.current!.height
                    );

                    // Get frame as base64 JPEG
                    const dataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.7);

                    // Send to WebSocket
                    wsRef.current.send(dataUrl);

                    // Clear any camera error since we successfully sent a frame
                    if (cameraError) setCameraError(null);

                    frameCount++;
                    if (frameCount % 30 === 0) {
                        console.log(`Sent ${frameCount} frames`);
                    }
                } catch (error) {
                    // Don't spam console with errors
                    const now = Date.now();
                    if (now - lastErrorTime > 5000) {
                        console.error("Error sending frame:", error);
                        lastErrorTime = now;
                    }
                }
            }

            // Schedule next frame if websocket is still open
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                setTimeout(sendFrame, 100); // Send at approximately 10 FPS
            }
        };

        // Start the sending loop
        sendFrame();
    };

    // Handle toggling between server feed and device camera view
    const handleToggleView = (checked: boolean) => {
        setShowServerFeed(!checked); // Invert the logic: checked means show device camera
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">License Plate Recognition</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Video Feed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 flex items-center space-x-2">
                            <Switch
                                id="camera-mode"
                                checked={!showServerFeed} // Invert the check state
                                onCheckedChange={handleToggleView}
                            />
                            <label htmlFor="camera-mode">
                                {showServerFeed ? "Show my camera view" : "Show server processed view"}
                            </label>

                            <span className={`ml-4 text-sm ${connectionStatus === "Connected" ? "text-green-500" : "text-red-500"
                                }`}>
                                WebSocket: {connectionStatus}
                            </span>
                        </div>

                        {cameraError && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded">
                                <p className="font-semibold">{cameraError}</p>
                                <p className="text-sm mt-1">
                                    Check your camera permissions or try restarting your browser.
                                </p>
                            </div>
                        )}

                        <div className="video-container relative">
                            {/* Always render both, but only show the one that's active */}
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-auto border rounded ${showServerFeed ? 'hidden' : 'block'}`}
                            ></video>

                            <img
                                src={`${API_BASE_URL}/video_feed`}
                                alt="Server Video Feed"
                                className={`w-full h-auto border rounded ${showServerFeed ? 'block' : 'hidden'}`}
                                onError={() => setCameraError("Server camera feed unavailable")}
                            />

                            <canvas
                                ref={canvasRef}
                                width="640"
                                height="480"
                                className="hidden"
                            ></canvas>

                            <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                {showServerFeed ? "Server Stream" : "Local Camera"}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Detected License Plate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="plate-display p-6 border rounded bg-gray-50 text-center mb-4">
                            {isLoading ? (
                                <p>Loading plate information...</p>
                            ) : (
                                <h3 className="text-4xl font-bold">{plateInfo.plate}</h3>
                            )}
                        </div>

                        <div className="mt-6">
                            <h3 className="text-xl font-semibold mb-2">Detection Details</h3>
                            {plateInfo.boxes && plateInfo.boxes.length > 0 ? (
                                <div className="space-y-2">
                                    {plateInfo.boxes.map((box: any, index: number) => (
                                        <div key={index} className="p-3 bg-gray-100 rounded">
                                            <p><strong>Plate:</strong> {box.plate}</p>
                                            <p><strong>Position:</strong> x:{box.x}, y:{box.y}, w:{box.w}, h:{box.h}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500">No detection details available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
