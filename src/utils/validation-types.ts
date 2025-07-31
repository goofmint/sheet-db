// Validation result types
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationResults {
  valid: boolean;
  errors: Record<string, string>;
}

// Validation rule interface
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // Regular expression pattern (stored as string)
  enum?: string[];
  errorMessage: string;
  default?: string | number | boolean;
}

// Config with validation
export interface ConfigWithValidation {
  key: string;
  value: string;
  type: string;
  description: string | null;
  validation: ValidationRule | null;
  system_config: boolean;
}