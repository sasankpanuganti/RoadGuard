export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface PotholeAnalysisResult {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'none';
  description: string;
  boundingBoxes: BoundingBox[];
}

export interface Report {
  id: string;
  userId: string; // "anonymous" for this demo or specific user
  imageUrl: string;
  location: LocationData;
  status: ReportStatus;
  timestamp: number;
  severity: string;
  description: string;
  isAutoDetected: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}