"use client";

import { useEffect, useRef, useState } from "react";

const CameraPage = () => {
  const [plate, setPlate] = useState<string | null>(null);
  const videoRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const fetchPlateFeed = async () => {
      const response = await fetch("http://localhost:8000/plate_feed");
      if (response.ok) {
        const data = await response.json();
        setPlate(data.plate);
      }
    };

    // Gọi plate feed mỗi giây
    const plateInterval = setInterval(fetchPlateFeed, 1000);

    return () => clearInterval(plateInterval); // Dừng interval khi component bị unmount
  }, []);

  useEffect(() => {
    const fetchVideoFeed = async () => {
      const videoFeed = "http://localhost:8000/video_feed";
      if (videoRef.current) {
        videoRef.current.src = videoFeed;  // Cập nhật video stream source
      }
    };

    fetchVideoFeed();
  }, []);

  return (
    <div>
      <h1>Camera Preview (Video Feed)</h1>

      {/* Video feed */}
      <div>
        <img ref={videoRef} alt="Video Feed" />
      </div>

      {/* Hiển thị biển số */}
      <div>
        <h2>Biển số nhận diện: {plate || "Chưa nhận diện được"}</h2>
      </div>
    </div>
  );
};

export default CameraPage;
