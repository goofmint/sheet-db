# 002 POST /api/v1/setup 部分更新対応 - API設計

## API仕様

### リクエスト形式

#### 部分更新リクエスト（推奨）
```typescript
interface PartialSetupRequest {
  updateFields: string[];  // 更新対象フィールドの配列
  google?: {
    clientId?: string;
    clientSecret?: string;
  };
  auth0?: {
    domain?: string;
    clientId?: string;
    clientSecret?: string;
  };
  app?: {
    configPassword?: string;
  };
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
  sheetId?: string;
}
```

#### フラット形式（既存互換）
```typescript
interface FlatSetupRequest {
  updateFields?: string[];  // オプション：指定されない場合は全フィールド更新
  "google.client_id"?: string;
  "google.client_secret"?: string;
  "auth0.domain"?: string;
  "auth0.client_id"?: string;
  "auth0.client_secret"?: string;
  "app.config_password"?: string;
  "storage.type"?: 'r2' | 'gdrive';
  "storage.r2.bucket"?: string;
  "storage.r2.accessKeyId"?: string;
  "storage.r2.secretAccessKey"?: string;
  "storage.r2.endpoint"?: string;
  "storage.gdrive.folderId"?: string;
  sheetId?: string;
}
```

### レスポンス形式

#### 成功レスポンス
```typescript
interface SetupPartialUpdateResponse {
  success: true;
  message: string;
  updated: {
    fields: string[];           // 実際に更新されたフィールドのリスト
    timestamp: string;
  };
  setup: {
    isCompleted: boolean;
    configuredServices: string[];
  };
  timestamp: string;
}
```

#### エラーレスポンス
```typescript
interface SetupPartialUpdateError {
  error: {
    code: string;
    message: string;
    details?: ValidationError[];
    invalidFields?: string[];   // 無効なupdateFieldsの一覧
  };
}
```

## 処理フロー

### 1. リクエスト解析フェーズ

```typescript
// 1.1 updateFields の解析
const determineUpdateMode = (requestData: any): UpdateMode => {
  if (requestData.updateFields && Array.isArray(requestData.updateFields)) {
    return {
      mode: 'partial',
      fields: requestData.updateFields
    };
  }
  
  // フラット形式の自動検出
  const hasNestedStructure = hasNestedKeys(requestData);
  const hasFlatStructure = hasFlatKeys(requestData);
  
  if (hasFlatStructure && !hasNestedStructure) {
    return {
      mode: 'flat',
      fields: extractFlatFields(requestData)
    };
  }
  
  // デフォルトは完全更新
  return { mode: 'complete', fields: [] };
};
```

### 2. バリデーションフェーズ

```typescript
// 2.1 updateFields の妥当性チェック
const validateUpdateFields = (fields: string[]): ValidationResult => {
  const validFields = [
    'google', 'google.clientId', 'google.clientSecret',
    'auth0', 'auth0.domain', 'auth0.clientId', 'auth0.clientSecret',
    'app', 'app.configPassword',
    'storage', 'storage.type', 'storage.r2', 'storage.gdrive',
    'sheetId'
  ];
  
  const invalidFields = fields.filter(field => !isValidField(field, validFields));
  
  return {
    isValid: invalidFields.length === 0,
    invalidFields
  };
};

// 2.2 条件付きバリデーション
const validatePartialRequest = (data: any, updateFields: string[]): ValidationResult => {
  const errors: ValidationError[] = [];
  
  for (const field of updateFields) {
    switch (field) {
      case 'google':
      case 'google.clientId':
      case 'google.clientSecret':
        validateGoogleConfig(data, field, errors);
        break;
      case 'storage':
        validateStorageConfig(data, errors);
        break;
      // ... 他のフィールド
    }
  }
  
  return { isValid: errors.length === 0, errors };
};
```

### 3. 設定更新フェーズ

```typescript
// 3.1 部分更新の実行
const executePartialUpdate = async (
  updateFields: string[],
  data: any
): Promise<UpdateResult> => {
  const updatedFields: string[] = [];
  const configs: Record<string, ConfigValue> = {};
  
  for (const field of updateFields) {
    const configEntries = mapFieldToConfigs(field, data);
    
    for (const [key, value] of configEntries) {
      // 既存値と異なる場合のみ更新
      const currentValue = ConfigService.getString(key);
      if (currentValue !== value.value) {
        configs[key] = value;
        updatedFields.push(key);
      }
    }
  }
  
  if (Object.keys(configs).length > 0) {
    await ConfigService.setAll(configs);
  }
  
  return { updatedFields, totalConfigs: Object.keys(configs).length };
};
```

## バリデーション仕様

### フィールド依存関係

```typescript
const fieldDependencies: Record<string, string[]> = {
  'storage': ['storage.type'],
  'storage.r2': ['storage.r2.bucket', 'storage.r2.accessKeyId', 'storage.r2.secretAccessKey', 'storage.r2.endpoint'],
  'storage.gdrive': ['storage.gdrive.folderId'],
  'google': ['google.clientId', 'google.clientSecret'],
  'auth0': ['auth0.domain', 'auth0.clientId', 'auth0.clientSecret']
};

const validateDependencies = (updateFields: string[], data: any): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  for (const field of updateFields) {
    const dependencies = fieldDependencies[field];
    if (dependencies) {
      for (const dep of dependencies) {
        if (!hasValidValue(data, dep)) {
          errors.push({
            field: dep,
            message: `${dep} is required when updating ${field}`
          });
        }
      }
    }
  }
  
  return errors;
};
```

### カスタムバリデーション

```typescript
const customValidations: Record<string, (value: any) => ValidationError[]> = {
  'google.clientId': (value: string) => {
    if (!value.endsWith('.googleusercontent.com')) {
      return [{ field: 'google.clientId', message: 'Invalid Google Client ID format' }];
    }
    return [];
  },
  
  'storage.type': (value: string, data: any) => {
    if (value === 'r2' && !data.storage?.r2) {
      return [{ field: 'storage.r2', message: 'R2 configuration required when storage type is r2' }];
    }
    if (value === 'gdrive' && !data.storage?.gdrive) {
      return [{ field: 'storage.gdrive', message: 'Google Drive configuration required when storage type is gdrive' }];
    }
    return [];
  }
};
```

## エラーハンドリング

### エラーコード定義

```typescript
enum SetupErrorCode {
  INVALID_UPDATE_FIELDS = 'INVALID_UPDATE_FIELDS',
  FIELD_DEPENDENCY_ERROR = 'FIELD_DEPENDENCY_ERROR',
  PARTIAL_VALIDATION_ERROR = 'PARTIAL_VALIDATION_ERROR',
  UPDATE_CONFLICT = 'UPDATE_CONFLICT',
  STORAGE_TYPE_MISMATCH = 'STORAGE_TYPE_MISMATCH'
}
```

### エラーレスポンス例

```typescript
// 無効なupdateFieldsの場合
{
  "error": {
    "code": "INVALID_UPDATE_FIELDS",
    "message": "Invalid update fields specified",
    "invalidFields": ["invalid.field", "google.unknown"]
  }
}

// 依存関係エラーの場合
{
  "error": {
    "code": "FIELD_DEPENDENCY_ERROR",
    "message": "Required dependencies missing",
    "details": [
      {
        "field": "storage.r2.bucket",
        "message": "R2 bucket is required when storage type is r2"
      }
    ]
  }
}
```

## 互換性保証

### 既存APIクライアント対応

1. **完全互換**: 既存のリクエスト形式は引き続き動作
2. **レスポンス互換**: 既存のレスポンス形式を維持
3. **段階的移行**: 新しい`updateFields`パラメータはオプション

### マイグレーション例

```typescript
// 既存のクライアントコード（変更不要）
const response = await fetch('/api/v1/setup', {
  method: 'POST',
  body: JSON.stringify({
    google: { clientId: '...', clientSecret: '...' },
    auth0: { domain: '...', clientId: '...', clientSecret: '...' },
    app: { configPassword: '...' }
  })
});

// 新しいクライアントコード（部分更新）
const response = await fetch('/api/v1/setup', {
  method: 'POST',
  body: JSON.stringify({
    updateFields: ['google'],
    google: { clientId: 'new-client-id', clientSecret: 'new-secret' }
  })
});
```