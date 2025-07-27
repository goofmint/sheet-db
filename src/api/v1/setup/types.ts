/**
 * Types for setup API endpoints
 */

export interface SetupStatusResponse {
  setup: {
    isCompleted: boolean;
    requiredFields: string[];
    completedFields: string[];
    currentConfig: {
      // セットアップ未完了時 OR Authorization認証済み時は実際の値
      google?: {
        clientId?: string;
        clientSecret?: string;
      };
      auth0?: {
        domain?: string;
        clientId?: string;
        clientSecret?: string;
      };
      // セットアップ完了時かつ未認証時はフラグのみ
      hasGoogleCredentials?: boolean;
      hasAuth0Config?: boolean;
    };
    nextSteps: string[];
    progress: {
      percentage: number;
      completedSteps: number;
      totalSteps: number;
    };
  };
  timestamp: string;
}

export interface SetupErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// POST API Types
export interface SetupRequest {
  google: {
    clientId: string;
    clientSecret: string;
  };
  auth0: {
    domain: string;
    clientId: string;
    clientSecret: string;
  };
  app: {
    configPassword: string;
  };
  // Optional storage configuration
  storage?: {
    type: 'r2' | 'gdrive';
    r2?: {
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
    };
    gdrive?: {
      folderId: string;
    };
  };
  // Optional selected sheet ID
  sheetId?: string;
}

export interface SetupSuccessResponse {
  success: true;
  message: string;
  setup: {
    isCompleted: true;
    completedAt: string;
    configuredServices: string[];
  };
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type SetupPostResponse = SetupSuccessResponse | SetupErrorResponse;