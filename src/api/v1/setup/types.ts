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
      database?: {
        url?: string;
      };
      // セットアップ完了時かつ未認証時はフラグのみ
      hasGoogleCredentials?: boolean;
      hasAuth0Config?: boolean;
      hasDatabaseConfig?: boolean;
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
  database?: {
    url?: string;
  };
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

export interface SetupValidationErrorResponse {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    details: {
      field: string;
      message: string;
    }[];
  };
  timestamp: string;
}

export interface SetupAuthErrorResponse {
  error: {
    code: "AUTHENTICATION_REQUIRED";
    message: string;
  };
  timestamp: string;
}

export interface SetupConflictErrorResponse {
  error: {
    code: "SETUP_ALREADY_COMPLETED" | "INVALID_CREDENTIALS";
    message: string;
  };
  timestamp: string;
}

export interface SetupServerErrorResponse {
  error: {
    code: "INTERNAL_ERROR";
    message: string;
  };
  timestamp: string;
}