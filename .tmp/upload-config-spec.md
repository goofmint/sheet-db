# ファイルアップロード設定管理仕様

## 概要
現在ハードコードされているファイルアップロード制限を、Configテーブルで動的に管理できるように改善する。

## 現在の問題

### ハードコードされた制限
```typescript
// src/api/v1/storages/route.ts
const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
const allowedTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
```

### 問題点
- 制限変更にはコード修正とデプロイが必要
- 運用環境ごとの柔軟な制限設定ができない
- セキュリティポリシーの変更に迅速に対応できない

## 改善仕様

### 1. ConfigServiceの拡張

#### 新規メソッドの追加
```typescript
// src/services/config.ts に追加予定
static getNumber(key: string, defaultValue?: number): number;
static getArray(key: string, defaultValue?: any[]): any[];
```

#### 実装詳細
```typescript
static getNumber(key: string, defaultValue: number = 0): number {
  const value = this.getString(key);
  if (!value) return defaultValue;
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

static getArray(key: string, defaultValue: any[] = []): any[] {
  const value = this.getString(key);
  if (!value) return defaultValue;
  
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : defaultValue;
  } catch {
    return defaultValue;
  }
}
```

### 2. 新規設定項目

#### アップロード機能の有効/無効
```typescript
'upload.enabled': {
  value: 'true',
  type: 'boolean',
  description: 'Enable or disable file upload functionality'
}
```

#### ファイルサイズ制限
```typescript
'upload.max_file_size': {
  value: '10485760', // 10MB in bytes
  type: 'number',
  description: 'Maximum file size for uploads in bytes'
}
```

#### 許可ファイルタイプ
```typescript
'upload.allowed_types': {
  value: JSON.stringify([
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  type: 'json',
  description: 'List of allowed MIME types for file uploads'
}
```

#### アップロード先ストレージの制限
```typescript
'upload.allowed_storage_types': {
  value: JSON.stringify(['r2', 'gdrive']),
  type: 'json',
  description: 'List of allowed storage types for uploads'
}
```

### 3. ストレージルートの改善

#### 現在の実装
```typescript
// ハードコードされた制限
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = ['image/jpeg', ...];
```

#### 改善後の実装
```typescript
// 動的な設定取得
const uploadEnabled = ConfigService.getBoolean('upload.enabled', true);
const maxFileSize = ConfigService.getNumber('upload.max_file_size', 10 * 1024 * 1024);
const allowedTypes = ConfigService.getArray('upload.allowed_types', [
  'image/jpeg', 'image/png', 'application/pdf'
]);
const allowedStorageTypes = ConfigService.getArray('upload.allowed_storage_types', ['r2', 'gdrive']);

// 機能有効性チェック
if (!uploadEnabled) {
  return c.json({
    error: 'Upload disabled',
    message: 'File upload functionality is currently disabled'
  }, 503);
}

// ストレージタイプの検証
if (!allowedStorageTypes.includes(storageType)) {
  return c.json({
    error: 'Storage not allowed',
    message: `Storage type ${storageType} is not permitted`
  }, 403);
}

// ファイルサイズ検証
if (file.size > maxFileSize) {
  return c.json({
    error: 'File too large',
    message: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`
  }, 413);
}

// ファイルタイプ検証
if (!allowedTypes.includes(file.type)) {
  return c.json({
    error: 'Invalid file type',
    message: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
  }, 415);
}
```

### 4. セットアップUIの改善

#### 新規セクションの追加
```html
<!-- ファイルアップロード設定セクション -->
<section class="config-section">
  <h3>File Upload Configuration</h3>
  
  <div class="form-group">
    <label for="upload-enabled">Enable File Upload</label>
    <input type="checkbox" id="upload-enabled" name="upload.enabled" />
  </div>
  
  <div class="form-group">
    <label for="max-file-size">Maximum File Size (MB)</label>
    <input type="number" id="max-file-size" name="upload.max_file_size" 
           min="1" max="100" step="1" />
  </div>
  
  <div class="form-group">
    <label for="allowed-types">Allowed File Types</label>
    <div class="checkbox-group">
      <label><input type="checkbox" value="image/jpeg" /> JPEG Images</label>
      <label><input type="checkbox" value="image/png" /> PNG Images</label>
      <label><input type="checkbox" value="image/gif" /> GIF Images</label>
      <label><input type="checkbox" value="application/pdf" /> PDF Documents</label>
      <label><input type="checkbox" value="text/csv" /> CSV Files</label>
      <label><input type="checkbox" value="application/json" /> JSON Files</label>
    </div>
  </div>
  
  <div class="form-group">
    <label for="allowed-storage">Allowed Storage Types</label>
    <div class="checkbox-group">
      <label><input type="checkbox" value="r2" /> Cloudflare R2</label>
      <label><input type="checkbox" value="gdrive" /> Google Drive</label>
    </div>
  </div>
</section>
```

### 5. バリデーション

#### 設定値の検証
```typescript
// ファイルサイズの範囲チェック
if (maxFileSize < 1024 || maxFileSize > 100 * 1024 * 1024) {
  throw new Error('File size must be between 1KB and 100MB');
}

// ファイルタイプの検証
const validMimeTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

for (const type of allowedTypes) {
  if (!validMimeTypes.includes(type)) {
    throw new Error(`Invalid MIME type: ${type}`);
  }
}

// ストレージタイプの検証
const validStorageTypes = ['r2', 'gdrive'];
for (const storage of allowedStorageTypes) {
  if (!validStorageTypes.includes(storage)) {
    throw new Error(`Invalid storage type: ${storage}`);
  }
}
```

## 実装ステップ

### Phase 1: ConfigService拡張
1. `getNumber()` メソッドの実装
2. `getArray()` メソッドの実装
3. 型安全性の確保

### Phase 2: デフォルト設定の追加
1. アップロード関連設定のデフォルト値を定義
2. `getConfigDescription()` の更新
3. マイグレーション用のセットアップスクリプト

### Phase 3: ストレージルートの改善
1. ハードコード値の削除
2. 動的設定取得への置き換え
3. エラーメッセージの改善

### Phase 4: セットアップUIの拡張
1. ファイルアップロード設定セクションの追加
2. フォームバリデーションの実装
3. 設定保存処理の更新

### Phase 5: テストとドキュメント
1. 単体テストの追加
2. 統合テストの更新
3. APIドキュメントの更新

## 期待される効果

### 運用面
- アプリケーション再起動なしでの制限変更
- 環境ごとの柔軟な設定管理
- セキュリティポリシーの迅速な適用

### 開発面
- ハードコード値の除去
- 設定の集中管理
- テスタビリティの向上

### セキュリティ面
- 動的なセキュリティポリシー適用
- インシデント時の迅速な制限強化
- 監査ログでの設定変更追跡