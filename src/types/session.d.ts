// User session information
export interface Session {
  id: string;
  userId: string;
  auth0Sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User information
export interface User {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Role information
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Auth0 user profile
export interface Auth0Profile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

// Authentication token information
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope?: string;
}

// Session validation result
export interface SessionValidation {
  valid: boolean;
  session?: Session;
  error?: string;
}