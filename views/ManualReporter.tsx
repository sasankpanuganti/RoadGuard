import React, { useState, useRef, useEffect } from 'react';
import { User, ReportStatus, BoundingBox } from '../types';
import { Button } from '../components/Button';
import { initializeModel, isModelLoaded } from '../services/yoloService';
import { saveReport } from '../services/storageService';

interface ManualReporterProps {
  user: User;
  onExit: () => void;
}

// Analyze image using YOLO via canvas
async function analyzeImageWithYOLO(base64Image: string): Promise<{
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'none';
  description: string;
  boundingBoxes: BoundingBox[];
}> {
  // Dynamically import to avoid issues with SSR
  const { analyzeFrame, initializeModel: initModel, isModelLoaded: checkModel } = await import('../services/yoloService');

  // Ensure model is loaded
  if (!checkModel()) {
    await initModel();
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      // Create canvas and draw image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({
          detected: false,
          severity: 'none',
          description: 'Failed to process image',
          boundingBoxes: []
        });
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      try {
        const result = await analyzeFrame(imageData, img.width, img.height);
        resolve(result);
      } catch (error) {
        console.error('YOLO analysis error:', error);
        resolve({
          detected: false,
          severity: 'none',
          description: 'Analysis failed',
          boundingBoxes: []
        });
      }
    };
    img.onerror = () => {
      resolve({
        detected: false,
        severity: 'none',
        description: 'Failed to load image',
        boundingBoxes: []
      });
    };
    img.src = base64Image;
  });
}

export const ManualReporter: React.FC<ManualReporterProps> = ({ user, onExit }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize YOLO model on mount
  useEffect(() => {
    initializeModel((progress) => {
      setLoadProgress(progress);
    })
      .then(() => setModelLoading(false))
      .catch((err) => {
        console.error('Model load error:', err);
        setModelLoading(false);
      });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImage(result);
      setAnnotatedImage(null);

      if (navigator.geolocation) {
        // High accuracy options for precise GPS location
        const geoOptions: PositionOptions = {
          enableHighAccuracy: true,  // Use GPS sensor on mobile
          timeout: 15000,            // Wait up to 15 seconds
          maximumAge: 0              // Don't use cached location
        };
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.error("Location access denied", err),
          geoOptions
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const drawBoxesOnImage = async (base64Img: string, boxes: BoundingBox[], severity: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Img);
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Draw boxes
        ctx.lineWidth = Math.max(4, img.width * 0.005);
        ctx.strokeStyle = '#ec4899'; // Pink-500
        const fontSize = Math.max(24, img.width * 0.03);
        ctx.font = `bold ${fontSize}px Arial`;

        boxes.forEach(box => {
          const x = box.xmin * img.width;
          const y = box.ymin * img.height;
          const w = (box.xmax - box.xmin) * img.width;
          const h = (box.ymax - box.ymin) * img.height;

          // Box
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.stroke();
          ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
          ctx.fill();

          // Label
          const label = `Pothole ${severity}`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(x, y - (fontSize + 10), textWidth + 20, fontSize + 10);
          ctx.fillStyle = 'white';
          ctx.fillText(label, x + 10, y - 8);
        });

        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = base64Img;
    });
  };

  const handleSubmit = async () => {
    if (!image || !location) return;

    setIsAnalyzing(true);

    // Analyze with YOLO
    const analysis = await analyzeImageWithYOLO(image);

    let finalImage = image;

    if (analysis.detected && analysis.boundingBoxes && analysis.boundingBoxes.length > 0) {
      finalImage = await drawBoxesOnImage(image, analysis.boundingBoxes, analysis.severity);
      setAnnotatedImage(finalImage);
    } else {
      // Even if no detection, still set annotatedImage to show report was submitted
      setAnnotatedImage(image);
    }

    await saveReport({
      id: Date.now().toString(),
      userId: user.id,
      imageUrl: finalImage,
      location: { latitude: location.lat, longitude: location.lng },
      status: ReportStatus.PENDING,
      timestamp: Date.now(),
      severity: analysis.detected ? analysis.severity : 'medium', // Default to medium if no AI detection
      description: analysis.detected
        ? analysis.description
        : 'Pothole reported by user. AI analysis pending.',
      isAutoDetected: false
    });

    setIsAnalyzing(false);

    setTimeout(() => {
      onExit();
    }, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-24">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Manual Report</h2>
            {modelLoading && (
              <p className="text-xs text-yellow-500 mt-1">Loading AI model... {loadProgress}%</p>
            )}
          </div>
          <button onClick={onExit} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8">
          {!image ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-800/50 transition-all group"
            >
              <div className="mx-auto h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="font-semibold text-slate-200 text-lg">Upload Evidence</p>
              <p className="text-sm text-slate-500 mt-2">Click to select or take a photo</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800">
                <img src={annotatedImage || image} alt="Preview" className="w-full h-full object-contain" />
                {!isAnalyzing && !annotatedImage && (
                  <button
                    onClick={() => setImage(null)}
                    className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-red-500 transition-colors backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <svg className="animate-spin h-10 w-10 text-blue-500 mb-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-white font-medium tracking-wide">Analyzing with YOLO AI...</p>
                  </div>
                )}
                {annotatedImage && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    REPORT SUBMITTED
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                {location ? (
                  <span className="font-mono">Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
                ) : (
                  <span className="animate-pulse">Acquiring GPS location...</span>
                )}
              </div>

              {!annotatedImage && (
                <Button
                  variant="gradient"
                  fullWidth
                  onClick={handleSubmit}
                  isLoading={isAnalyzing}
                  disabled={!location || isAnalyzing || modelLoading}
                  className="h-14 text-lg"
                >
                  {modelLoading ? 'Loading AI Model...' : 'Submit Report'}
                </Button>
              )}
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
};