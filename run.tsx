'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';

const API_URL = 'http://localhost:8000';

export default function Home() {
    const [plateData, setPlateData] = useState<{ plate: string, boxes: any[] }>({ plate: 'No plate detected', boxes: [] });
    const [selectedCamera, setSelectedCamera] = useState<string>('webcam');
    const [uploadMode, setUploadMode] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [streaming, setStreaming] = useState<boolean>(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [processingFrame, setProcessingFrame] = useState<boolean>(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null); useEffect(() => {
        // Initialize webcam if it exists in the browser
        try {
            if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
                startWebcam();
            } else {
                console.error('MediaDevices API not supported');
                alert('Sorry, your browser doesn\'t support accessing the webcam.');
            }
        } catch (err) {
            console.error('Error initializing webcam:', err);
        }

        // Clean up function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            stopWebcam();
        };
    }, []);

    useEffect(() => {
        // Poll for license plate data
        const fetchPlateData = async () => {
            try {
                const response = await fetch(`${API_URL}/get_plate`);
                if (response.ok) {
                    const data = await response.json();
                    setPlateData(data);
                }
            } catch (error) {
                console.error('Error fetching license plate data:', error);
            }
        };

        const intervalId = setInterval(fetchPlateData, 1000);
        return () => clearInterval(intervalId);
    }, []);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setStreaming(true);

                // Start frame processing interval
                intervalRef.current = setInterval(processFrame, 500);
            }
        } catch (err) {
            console.error('Error accessing the webcam:', err);
            alert('Error accessing the webcam. Please check your camera permissions.');
        }
    };

    const stopWebcam = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();

            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setStreaming(false);
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const processFrame = async () => {
        if (!videoRef.current || !canvasRef.current || processingFrame) return;

        setProcessingFrame(true);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw the current frame to the canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert canvas to blob
            canvas.toBlob(async (blob) => {
                if (!blob) return;

                // Create form data with the image
                const formData = new FormData();
                formData.append('file', blob, 'frame.jpg');

                // Send the frame to the API
                try {
                    const response = await fetch(`${API_URL}/upload_frame`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setPlateData({ plate: data.plate, boxes: data.boxes });
                        setCapturedImage(`data:image/jpeg;base64,${data.frame}`);
                    }
                } catch (error) {
                    console.error('Error sending frame to API:', error);
                } finally {
                    setProcessingFrame(false);
                }
            }, 'image/jpeg', 0.8);
        } catch (error) {
            console.error('Error processing frame:', error);
            setProcessingFrame(false);
        }
    };

    const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        setProcessingFrame(true);

        try {
            const response = await fetch(`${API_URL}/upload_frame`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setPlateData({ plate: data.plate, boxes: data.boxes });
                setCapturedImage(`data:image/jpeg;base64,${data.frame}`);
            }
        } catch (error) {
            console.error('Error uploading image:', error);
        } finally {
            setProcessingFrame(false);
        }
    };

    const toggleMode = () => {
        setUploadMode(!uploadMode);
        if (uploadMode) {
            startWebcam();
        } else {
            stopWebcam();
        }
    };

    const handleManualCapture = () => {
        processFrame();
    };
    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <h1 className={styles.title}>Park Scan - License Plate Recognition</h1>

                <div className={styles.controlsContainer}>
                    <button
                        className={styles.button}
                        onClick={toggleMode}
                    >
                        {uploadMode ? 'Switch to Webcam' : 'Switch to Upload'}
                    </button>

                    {!uploadMode && (
                        <button
                            className={styles.button}
                            onClick={handleManualCapture}
                            disabled={processingFrame}
                        >
                            Capture Frame
                        </button>
                    )}
                </div>

                <div className={styles.contentContainer}>
                    <div className={styles.videoContainer}>
                        {!uploadMode ? (
                            <>
                                <video
                                    ref={videoRef}
                                    className={styles.video}
                                    autoPlay
                                    playsInline
                                    muted
                                />
                                <canvas
                                    ref={canvasRef}
                                    className={styles.canvas}
                                />
                            </>
                        ) : (
                            <div className={styles.uploadArea}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={uploadImage}
                                    className={styles.fileInput}
                                    disabled={processingFrame}
                                />
                                <p>Click to choose an image</p>
                            </div>
                        )}

                        {capturedImage && (
                            <div className={styles.resultContainer}>
                                <h3>Processed Image</h3>
                                <img
                                    src={capturedImage}
                                    className={styles.processedImage}
                                    alt="Processed frame"
                                />
                            </div>
                        )}
                    </div>

                    <div className={styles.infoContainer}>
                        <div className={styles.plateInfo}>
                            <h2>License Plate</h2>
                            <div className={styles.plateDisplay}>
                                <span className={styles.plateText}>{plateData.plate}</span>
                            </div>

                            <div className={styles.detectionInfo}>
                                <h3>Detection Information</h3>
                                {plateData.boxes && plateData.boxes.length > 0 ? (
                                    <ul className={styles.boxesList}>
                                        {plateData.boxes.map((box, index) => (
                                            <li key={index}>
                                                Detected at: X:{box.x}, Y:{box.y}, W:{box.w}, H:{box.h} - {box.plate}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No license plates detected in current frame</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}