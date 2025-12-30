// API Configuration
// In production (Vercel), use the EC2 backend URL
// In development, use localhost

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005';
