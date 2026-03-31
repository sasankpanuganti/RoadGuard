/**
 * YOLO v8 Pothole Detection Service
 * Browser-based inference using ONNX Runtime Web
 */

import * as ort from 'onnxruntime-web';
import { PotholeAnalysisResult, BoundingBox } from '../types';

// Model configuration
const MODEL_PATH = '/models/yolov8n-pothole.onnx';
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

// Model state
let session: ort.InferenceSession | null = null;
let isLoading = false;

/**
 * Initialize the YOLO model
 * @param onProgress Optional callback for loading progress
 */
export async function initializeModel(
    onProgress?: (progress: number) => void
): Promise<void> {
    if (session) {
        console.log('[YOLO] Model already loaded');
        return;
    }

    if (isLoading) {
        console.log('[YOLO] Model already loading...');
        return;
    }

    isLoading = true;
    onProgress?.(0);

    try {
        console.log('[YOLO] Loading model from:', MODEL_PATH);

        // Configure ONNX Runtime for WebAssembly
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';

        onProgress?.(20);

        // Fetch model with progress tracking
        const response = await fetch(MODEL_PATH);
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status}`);
        }

        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Failed to get response reader');

        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            received += value.length;

            if (total) {
                const progress = 20 + Math.floor((received / total) * 60);
                onProgress?.(progress);
            }
        }

        // Combine chunks into single buffer
        const modelBuffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            modelBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        onProgress?.(85);

        // Create inference session
        session = await ort.InferenceSession.create(modelBuffer.buffer, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        });

        onProgress?.(100);
        console.log('[YOLO] Model loaded successfully');
        console.log('[YOLO] Input names:', session.inputNames);
        console.log('[YOLO] Output names:', session.outputNames);

    } catch (error) {
        console.error('[YOLO] Model loading failed:', error);
        throw error;
    } finally {
        isLoading = false;
    }
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
    return session !== null;
}

/**
 * Preprocess image data for YOLO input
 */
function preprocessImage(imageData: ImageData): Float32Array {
    const { data, width, height } = imageData;

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d')!;

    // Draw original image scaled to 640x640
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const resizedData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

    // Convert to CHW format (channels first) and normalize to 0-1
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
    const pixels = resizedData.data;

    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        const pixelIdx = i * 4;
        tensor[i] = pixels[pixelIdx] / 255.0; // R
        tensor[INPUT_SIZE * INPUT_SIZE + i] = pixels[pixelIdx + 1] / 255.0; // G
        tensor[2 * INPUT_SIZE * INPUT_SIZE + i] = pixels[pixelIdx + 2] / 255.0; // B
    }

    return tensor;
}

/**
 * Apply Non-Maximum Suppression
 */
function nms(
    boxes: number[][],
    scores: number[],
    iouThreshold: number
): number[] {
    const indices: number[] = [];
    const sortedIndices = scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.idx);

    const suppressed = new Set<number>();

    for (const i of sortedIndices) {
        if (suppressed.has(i)) continue;
        indices.push(i);

        for (const j of sortedIndices) {
            if (i === j || suppressed.has(j)) continue;

            const iou = calculateIoU(boxes[i], boxes[j]);
            if (iou > iouThreshold) {
                suppressed.add(j);
            }
        }
    }

    return indices;
}

/**
 * Calculate IoU between two boxes
 */
function calculateIoU(box1: number[], box2: number[]): number {
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    const xA = Math.max(x1_1, x1_2);
    const yA = Math.max(y1_1, y1_2);
    const xB = Math.min(x2_1, x2_2);
    const yB = Math.min(y2_1, y2_2);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
    const unionArea = box1Area + box2Area - interArea;

    return interArea / unionArea;
}

/**
 * Map confidence score to severity level
 */
function mapConfidenceToSeverity(
    confidence: number,
    boxCount: number
): 'low' | 'medium' | 'high' | 'none' {
    if (boxCount === 0) return 'none';

    // Higher confidence or more detections = higher severity
    if (confidence >= 0.7 || boxCount >= 3) return 'high';
    if (confidence >= 0.45 || boxCount >= 2) return 'medium';
    return 'low';
}

/**
 * Generate natural language description from detections
 */
function generateDescription(
    boxes: BoundingBox[],
    severity: 'low' | 'medium' | 'high' | 'none',
    avgConfidence: number
): string {
    if (boxes.length === 0) {
        return 'Road surface appears intact with no visible potholes or damage.';
    }

    const count = boxes.length;
    const certainty = avgConfidence > 0.7 ? 'clearly visible' : 'detected';

    // Calculate average size
    const avgSize = boxes.reduce((sum, box) => {
        return sum + (box.xmax - box.xmin) * (box.ymax - box.ymin);
    }, 0) / boxes.length;

    const sizeDesc = avgSize > 0.1 ? 'large' : avgSize > 0.04 ? 'medium-sized' : 'small';

    if (severity === 'high') {
        if (count >= 3) {
            return `Numerous ${sizeDesc} potholes are ${certainty} across the road surface, indicating significant road damage requiring immediate attention. Multiple hazards present that may affect vehicle safety.`;
        }
        return `Significant pothole damage ${certainty} on the road surface. ${count > 1 ? 'Multiple potholes' : 'A large pothole'} present, posing potential hazard to vehicles and requiring repair.`;
    }

    if (severity === 'medium') {
        return `${count > 1 ? 'Multiple moderate potholes' : 'A moderate pothole'} ${certainty} on the road surface. May pose hazard to vehicles and should be addressed.`;
    }

    return `Minor road surface damage ${certainty}. ${count > 1 ? 'Small cracks or shallow depressions' : 'A small crack or shallow depression'} observed that may require monitoring.`;
}

/**
 * Analyze a video frame for potholes
 */
export async function analyzeFrame(
    imageData: ImageData,
    originalWidth: number,
    originalHeight: number
): Promise<PotholeAnalysisResult> {
    if (!session) {
        throw new Error('Model not initialized. Call initializeModel first.');
    }

    try {
        // Preprocess image
        const inputTensor = preprocessImage(imageData);

        // Create ONNX tensor
        const feeds = {
            [session.inputNames[0]]: new ort.Tensor('float32', inputTensor, [1, 3, INPUT_SIZE, INPUT_SIZE])
        };

        // Run inference
        const results = await session.run(feeds);
        const output = results[session.outputNames[0]];
        const outputData = output.data as Float32Array;

        // Parse YOLO output (format: [batch, num_detections, 5+num_classes] or similar)
        // YOLOv8 outputs [1, 5+num_classes, num_predictions] then transposed
        const boxes: number[][] = [];
        const scores: number[] = [];
        const boundingBoxes: BoundingBox[] = [];

        // Handle YOLOv8 output format: [1, 5, 8400]
        // where 5 = [x_center, y_center, width, height, confidence]
        const dims = output.dims;
        const numPredictions = dims[2] || 8400;
        const numValues = dims[1] || 5;

        for (let i = 0; i < numPredictions; i++) {
            // YOLOv8 format: each column is a prediction
            const confidence = outputData[4 * numPredictions + i]; // class confidence

            if (confidence >= CONFIDENCE_THRESHOLD) {
                const x_center = outputData[0 * numPredictions + i];
                const y_center = outputData[1 * numPredictions + i];
                const width = outputData[2 * numPredictions + i];
                const height = outputData[3 * numPredictions + i];

                // Convert from center format to corner format and normalize
                const x1 = (x_center - width / 2) / INPUT_SIZE;
                const y1 = (y_center - height / 2) / INPUT_SIZE;
                const x2 = (x_center + width / 2) / INPUT_SIZE;
                const y2 = (y_center + height / 2) / INPUT_SIZE;

                boxes.push([x1, y1, x2, y2]);
                scores.push(confidence);
            }
        }

        // Apply NMS
        const keepIndices = nms(boxes, scores, IOU_THRESHOLD);

        // Convert to BoundingBox format
        for (const idx of keepIndices) {
            const [x1, y1, x2, y2] = boxes[idx];
            boundingBoxes.push({
                xmin: Math.max(0, x1),
                ymin: Math.max(0, y1),
                xmax: Math.min(1, x2),
                ymax: Math.min(1, y2)
            });
        }

        // Calculate average confidence
        const avgConfidence = keepIndices.length > 0
            ? keepIndices.reduce((sum, idx) => sum + scores[idx], 0) / keepIndices.length
            : 0;

        // Determine severity
        const severity = mapConfidenceToSeverity(avgConfidence, boundingBoxes.length);

        // Generate description
        const description = generateDescription(boundingBoxes, severity, avgConfidence);

        return {
            detected: boundingBoxes.length > 0,
            severity,
            description,
            boundingBoxes
        };

    } catch (error) {
        console.error('[YOLO] Inference error:', error);
        return {
            detected: false,
            severity: 'none',
            description: 'Analysis failed due to processing error.',
            boundingBoxes: []
        };
    }
}

/**
 * Get ImageData from canvas
 */
export function getImageDataFromCanvas(
    canvas: HTMLCanvasElement
): ImageData | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
