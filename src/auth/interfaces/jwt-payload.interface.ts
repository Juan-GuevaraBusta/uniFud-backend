export interface JwtPayload {
  sub: string;         // User ID
  email: string;       // User email
  role: string;        // User role
  iat?: number;        // Issued at
  exp?: number;        // Expiration time
}




