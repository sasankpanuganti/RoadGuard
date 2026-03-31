import { User, UserRole } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'John Driver', email: 'john.driver@example.com', role: UserRole.USER },
  { id: 'a1', name: 'City Admin', email: 'admin@city.gov', role: UserRole.ADMIN },
];

export const APP_NAME = "RoadGuard AI";
export const GEMINI_MODEL = "gemini-2.5-flash"; // Fast model for live detection