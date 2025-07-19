export interface BaseSuccessResponse {
  success: true;
}

export interface BaseErrorResponse {
  success: false;
  error: string;
}

export interface BaseSuccessResponseWithData<T> extends BaseSuccessResponse {
  data: T;
}

export interface BaseSuccessResponseWithMessage extends BaseSuccessResponse {
  message: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  picture?: string;
  email_verified?: boolean;
  locale?: string;
  created_at: string;
  updated_at: string;
  public_read: boolean;
  public_write: boolean;
  role_read: string[];
  role_write: string[];
  user_read: string[];
  user_write: string[];
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  name: string;
  users: string[];
  roles: string[];
  created_at: string;
  updated_at: string;
  public_read: boolean;
  public_write: boolean;
  role_read: string[];
  role_write: string[];
  user_read: string[];
  user_write: string[];
}

export interface AuthStartData {
  authUrl: string;
  redirectUri: string;
}

export interface AuthCallbackData {
  sessionId: string;
  user: User;
  session?: Session;
}

export interface RolesData {
  roles: Role[];
}

export interface FileUploadData {
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface SetupProgress {
  currentSheet: string;
  currentStep: string;
  completedSheets: string[];
  totalSheets: number;
  progress: number;
  status: string;
  error?: string;
}

export interface SheetSetupProgressData {
  setupId: string;
  status: string;
  progress: SetupProgress;
}

export type AuthStartResponse = BaseSuccessResponseWithData<AuthStartData>;
export type AuthCallbackResponse = BaseSuccessResponseWithData<AuthCallbackData>;
export type AuthLogoutResponse = BaseSuccessResponse;
export type UserMeResponse = BaseSuccessResponseWithData<User>;
export type UserUpdateResponse = BaseSuccessResponseWithData<User>;
export type UserDeleteResponse = BaseSuccessResponseWithMessage;
export type RolesResponse = BaseSuccessResponseWithData<RolesData>;
export type RoleCreateResponse = BaseSuccessResponseWithData<Role>;
export type RoleUpdateResponse = BaseSuccessResponseWithData<Role>;
export type RoleDeleteResponse = BaseSuccessResponseWithMessage;
export type FileUploadResponse = BaseSuccessResponseWithData<FileUploadData>;
export type SetupResponse = BaseSuccessResponse;
export type SpreadsheetSelectionResponse = BaseSuccessResponseWithData<{ resetSheetStatus: boolean }>;
export type SheetSetupProgressResponse = SheetSetupProgressData;
export type ApiErrorResponse = BaseErrorResponse;

export type ApiResponse<T> = T | ApiErrorResponse;