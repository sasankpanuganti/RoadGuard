import React, { useEffect, useRef, useState, useCallback } from 'react';
import { User, ReportStatus, BoundingBox } from '../types';
import { initializeModel, analyzeFrame, isModelLoaded, getImageDataFromCanvas } from '../services/yoloService';
import { saveReport, hasNearbyReport } from '../services/storageService';

interface LiveDetectorProps {
  user: User;
  onExit: () => void;
}

export const LiveDetector: React.FC<LiveDetectorProps> = ({ user, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastDetectionTime, setLastDetectionTime] = useState(0);
  const [overlayBoxes, setOverlayBoxes] = useState<BoundingBox[]>([]);
  const [currentSeverity, setCurrentSeverity] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 4));

  // Initialize YOLO model on mount
  useEffect(() => {
    addLog("Loading YOLO model...");
    initializeModel((progress) => {
      setLoadProgress(progress);
      if (progress === 100) {
        addLog("✓ YOLO model loaded!");
      }
    })
      .then(() => {
        setModelLoading(false);
        addLog("AI Ready for detection.");
      })
      .catch((err) => {
        console.error("Model load error:", err);
        addLog(`Error: ${err.message}`);
        setModelLoading(false);
      });
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsScanning(true);
        addLog("Camera started.");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      addLog("Error: Camera access denied.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
    }
    setIsScanning(false);
  };

  const drawDetectionOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number, boxes: BoundingBox[], severity: string) => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ec4899'; // Pink-500
    ctx.font = 'bold 24px Arial';

    boxes.forEach(box => {
      const x = box.xmin * width;
      const y = box.ymin * height;
      const w = (box.xmax - box.xmin) * width;
      const h = (box.ymax - box.ymin) * height;

      // Draw box
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();

      // Fill semi-transparent
      ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      ctx.fill();

      // Label background
      const label = `Pothole ${severity}`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(x, y - 30, textWidth + 20, 30);

      // Label text
      ctx.fillStyle = 'white';
      ctx.fillText(label, x + 10, y - 6);
    });
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded()) return;

    // Prevent concurrent saves
    if (isSaving) {
      return;
    }

    // Debounce: Wait 8s after last detection before allowing new reports
    if (Date.now() - lastDetectionTime < 8000) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Capture current frame
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;
    if (width === 0 || height === 0) return;

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    ctx.drawImage(videoRef.current, 0, 0, width, height);

    // Get ImageData for YOLO
    const imageData = getImageDataFromCanvas(canvasRef.current);
    if (!imageData) return;

    try {
      const analysis = await analyzeFrame(imageData, width, height);

      if (analysis.detected) {
        addLog(`✓ ${analysis.boundingBoxes.length} pothole(s) detected!`);
        setLastDetectionTime(Date.now());
        setCurrentSeverity(analysis.severity);

        // Show overlay
        if (analysis.boundingBoxes && analysis.boundingBoxes.length > 0) {
          setOverlayBoxes(analysis.boundingBoxes);
          setTimeout(() => setOverlayBoxes([]), 3000);

          // Draw boxes on canvas for saved image
          drawDetectionOverlay(ctx, width, height, analysis.boundingBoxes, analysis.severity);
        }

        // Get annotated image
        const annotatedImage = canvasRef.current.toDataURL('image/jpeg', 0.7);

        // Set saving flag
        setIsSaving(true);
        addLog("Getting location for report...");

        // Geolocation options for high accuracy
        const geoOptions: PositionOptions = {
          enableHighAccuracy: true,  // Use GPS on mobile for precise location
          timeout: 10000,            // Wait up to 10 seconds
          maximumAge: 0              // Don't use cached location, get fresh coords
        };

        // Get Location and Save
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const { latitude, longitude, accuracy } = pos.coords;
            addLog(`Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy?.toFixed(0) || '?'}m)`);

            // Check for duplicates (within 50 meters)
            const hasDuplicate = await hasNearbyReport(latitude, longitude);
            if (hasDuplicate) {
              addLog("⚠️ Duplicate skipped (nearby report exists).");
              setIsSaving(false);
              return;
            }

            addLog("Saving report to database...");
            await saveReport({
              id: Date.now().toString(),
              userId: user.id,
              imageUrl: annotatedImage,
              location: { latitude, longitude },
              status: ReportStatus.PENDING,
              timestamp: Date.now(),
              severity: analysis.severity,
              description: analysis.description,
              isAutoDetected: true
            });
            addLog("✅ Report saved successfully!");
            setLastDetectionTime(Date.now());
          } catch (error) {
            console.error('Error saving report:', error);
            addLog(`❌ Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
            setIsSaving(false);
          }
        }, (err) => {
          console.error('Geolocation error:', err);
          addLog(`❌ Location failed: ${err.message}`);
          setIsSaving(false);
        }, geoOptions);
      }
    } catch (e) {
      console.error("Analysis error", e);
      addLog(`Error: ${e instanceof Error ? e.message : 'Analysis failed'}`);
    }
  }, [lastDetectionTime, user.id, isSaving]);

  // Start camera when model is loaded
  useEffect(() => {
    if (!modelLoading) {
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelLoading]);

  // Run analysis loop - faster interval since YOLO is local
  useEffect(() => {
    if (isScanning && !modelLoading) {
      // Analyze every 1 second (YOLO is fast, no API quota)
      intervalRef.current = window.setInterval(captureAndAnalyze, 1000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [isScanning, modelLoading, captureAndAnalyze]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full animate-pulse ${modelLoading ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
          <span className="text-white font-mono text-sm font-bold">
            {modelLoading ? 'LOADING MODEL...' : 'YOLO LIVE DETECTION'}
          </span>
        </div>
        <button
          onClick={onExit}
          className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Exit
        </button>
      </div>

      {/* Model Loading Overlay */}
      {modelLoading && (
        <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center">
          <div className="w-64 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-4">🔍</div>
              <h2 className="text-xl font-bold text-white mb-2">Loading AI Model</h2>
              <p className="text-slate-400 text-sm">Preparing pothole detection...</p>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <p className="text-center text-slate-400 text-sm">{loadProgress}%</p>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <div className="flex-1 relative bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* Hidden Canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Detection Overlay */}
        {overlayBoxes.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {overlayBoxes.map((box, idx) => (
              <div
                key={idx}
                className="absolute border-4 border-pink-500 bg-pink-500/20 animate-pulse"
                style={{
                  top: `${box.ymin * 100}%`,
                  left: `${box.xmin * 100}%`,
                  height: `${(box.ymax - box.ymin) * 100}%`,
                  width: `${(box.xmax - box.xmin) * 100}%`
                }}
              >
                <div className="absolute -top-8 left-0 bg-pink-500 text-white text-xs font-bold px-2 py-1 whitespace-nowrap">
                  Pothole {currentSeverity}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HUD Grid */}
        <div className="absolute inset-0 border-[20px] border-transparent pointer-events-none">
          <div className="w-full h-full border-2 border-white/20 rounded-xl relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 border-b-2 border-white/50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-1 border-r-2 border-white/50"></div>
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="h-48 bg-slate-900 p-4 rounded-t-2xl -mt-4 relative z-10 border-t border-slate-700">
        <h3 className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">System Logs</h3>
        <div className="space-y-2 font-mono text-sm">
          {logs.map((log, i) => (
            <div key={i} className={`flex items-center gap-2 ${i === 0 ? 'text-green-400' : 'text-slate-500'}`}>
              <span>{'>'}</span>
              <span>{log}</span>
            </div>
          ))}
          {logs.length === 0 && <span className="text-slate-600">Initializing vision system...</span>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>Model: YOLOv11 Pothole</span>
          <span>Interval: 1000ms</span>
        </div>
      </div>
    </div>
  );
};