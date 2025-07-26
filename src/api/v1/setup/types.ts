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