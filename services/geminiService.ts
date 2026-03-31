import { GoogleGenAI, Type } from "@google/genai";
import { PotholeAnalysisResult } from '../types';
import { GEMINI_MODEL } from '../constants';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key is missing");
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeImageForPothole = async (base64Image: string): Promise<PotholeAnalysisResult> => {
  try {
    const ai = getAiClient();

    // Remove data URL prefix if present for API consumption
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    console.log("[Gemini] Sending image for analysis, size:", cleanBase64.length);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `You are a road damage detection AI. Analyze this image for potholes, road cracks, and road surface damage.

DETECTION CRITERIA - Look for ANY of these:
1. Potholes: Holes or depressions in the road surface (any size)
2. Cracks: Large cracks, alligator cracking, or road fractures
3. Surface damage: Broken pavement, missing asphalt, or severe wear
4. Water-filled holes: Puddles that indicate depressions in the road
5. Edge damage: Damaged road edges or shoulders

Be SENSITIVE in detection - if there's any visible road damage or irregularity, mark it as detected.
For live camera feeds, the image may be slightly blurry or at an angle - still analyze carefully.

Return JSON with:
- 'detected': true if ANY road damage is visible, false only if road appears completely intact
- 'severity': 'low' (minor cracks/wear), 'medium' (visible potholes/damage), 'high' (severe damage/large holes), 'none' (no damage)
- 'description': Brief description of what was found (e.g., "Small pothole detected" or "Road surface appears intact")
- 'boundingBoxes': Array of {ymin, xmin, ymax, xmax} in 0-1 normalized coordinates for each damaged area found`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'none'] },
            description: { type: Type.STRING },
            boundingBoxes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ['detected', 'severity', 'description', 'boundingBoxes']
        }
      }
    });

    const text = response.text;
    console.log("[Gemini] Raw response:", text);

    if (!text) throw new Error("No response from AI");

    const result = JSON.parse(text) as PotholeAnalysisResult;
    console.log("[Gemini] Parsed result:", result);

    return result;

  } catch (error) {
    console.error("[Gemini] Analysis Failed:", error);

    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota');

    return {
      detected: false,
      severity: 'none',
      description: isRateLimitError
        ? "API quota exceeded. Wait a minute or upgrade your plan."
        : "Analysis failed due to network or API error.",
      boundingBoxes: []
    };
  }
};