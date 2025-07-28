// Auth0 configuration types
export interface Auth0Config {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience?: string;
  scope: string;
}

// Auth0 token exchange request
export interface TokenExchangeRequest {
  grant_type: 'authorization_code';
  client_id: string;
  client_secret: string;
  code: string;
  redirect_uri: string;
}

// Auth0 token response
export interface Auth0TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// Auth0 refresh token request
export interface RefreshTokenRequest {
  grant_type: 'refresh_token';
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

// Auth0 error response
export interface Auth0ErrorResponse {
  error: string;
  error_description?: string;
}

// JWKS response types
export interface JWK {
  alg: string;
  kty: string;
  use: string;
  n: string;
  e: string;
  kid: string;
  x5t?: string;
  x5c?: string[];
}

export interface JWKS {
  keys: JWK[];
}

// JWT payload
export interface JWTPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  exp: number;
  azp?: string;
  scope?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}