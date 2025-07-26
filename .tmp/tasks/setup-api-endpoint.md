# Task: src/api/v1/setup/get.tsの作成（セットアップ画面API）

## 概要
`src/api/v1/setup/get.ts`を作成し、セットアップ画面を提供するAPIエンドポイントを実装する。

## 目的
- APIバージョン管理に対応したセットアップエンドポイントの作成
- 既存の`/setup`ルートとの一貫性を保ちつつAPI化
- 将来的なフロントエンド分離への対応準備
- セットアップ状態の適切な管理

## 実装要件

### 1. ファイル作成
- **ファイルパス**: `src/api/v1/setup/get.ts`
- **エクスポート**: `setupGetHandler`関数
- **型安全性**: TypeScriptの完全な型定義

### 2. 機能仕様

#### エンドポイント定義
- **メソッド**: `GET`
- **パス**: `/api/v1/setup`
- **レスポンス形式**: JSON（セットアップ状態情報）

#### レスポンス内容
```typescript
interface SetupStatusResponse {
  setup: {
    isCompleted: boolean;
    requiredFields: string[];
    completedFields: string[];
    currentConfig: {
      // セットアップ未完了時 OR X-CONFIG認証済み時は実際の値
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
```

### 3. 技術仕様

#### セットアップ状態の分析
- 必要な設定項目の洗い出し
- 設定完了状況の正確な判定
- 次に必要なアクションの提示

#### 設定状態の確認
- `ConfigService`を使用した設定状態の取得
- セットアップ完了状態の判定
- 必要な設定項目の一覧化

#### エラーハンドリング
- 設定読み込みエラーの適切な処理
- データベース接続エラーの処理
- 統一エラーハンドラーとの連携

### 4. セキュリティ考慮事項

#### アクセス制御（重要）
```typescript
// セットアップ状態に応じたアクセス制御
const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
const configPassword = c.req.header('X-CONFIG');

if (isSetupCompleted) {
  // セットアップ完了時：config_password認証が必要
  const storedPassword = ConfigService.getString('app.config_password');
  
  if (!configPassword || configPassword !== storedPassword) {
    return c.json({ 
      error: { 
        code: 'AUTHENTICATION_REQUIRED',
        message: 'X-CONFIG header required for setup information access' 
      } 
    }, 401);
  }
  
  // 認証成功：再セットアップのため設定値も含めて返す
  return c.json(getDetailedSetupStatus());
} else {
  // セットアップ未完了：自由にアクセス可能（設定値も含む）
  return c.json(getDetailedSetupStatus());
}
```

#### 機密情報の保護
- セットアップ未完了時：設定値を返す（初期セットアップ用）
- セットアップ完了時：X-CONFIG認証後のみ設定値を返す（再セットアップ用）
- 未認証時：設定済みフラグのみ返す
- パスワードハッシュは安全に管理（平文では返さない）
- APIキーやシークレットは適切な認証後のみ返す

### 5. 既存システムとの連携

#### 既存ルートとの関係
- `/setup` (既存) - HTMLセットアップ画面
- `/api/v1/setup` (新規) - セットアップ状態取得API
- 役割分離による明確な責任範囲

#### ConfigServiceとの統合
```typescript
// 設定状態の確認と値の取得
const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
const isAuthenticated = validateConfigPassword(c.req.header('X-CONFIG'));

// 認証状態に応じたデータ取得
if (!isSetupCompleted || isAuthenticated) {
  // セットアップ未完了時 OR 認証済み時：実際の値を返す（再セットアップ用）
  const currentConfig = {
    google: {
      clientId: ConfigService.getString('google.client_id'),
      clientSecret: ConfigService.getString('google.client_secret'),
    },
    auth0: {
      domain: ConfigService.getString('auth0.domain'),
      clientId: ConfigService.getString('auth0.client_id'),
      clientSecret: ConfigService.getString('auth0.client_secret'),
    },
    database: {
      url: ConfigService.getString('database.url'),
    }
  };
} else {
  // セットアップ完了時かつ未認証：フラグのみ
  const currentConfig = {
    hasGoogleCredentials: !!ConfigService.getString('google.client_id'),
    hasAuth0Config: !!ConfigService.getString('auth0.domain'),
    hasDatabaseConfig: !!ConfigService.getString('database.url'),
  };
}
```

### 6. API設計パターン

#### RESTful設計
- リソース指向の設計
- 適切なHTTPステータスコード使用
- 標準的なHTTPヘッダー活用

#### JSON API設計（認証考慮）
```typescript
// セットアップ状態に応じた情報提供
const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
const configPassword = c.req.header('X-CONFIG');
const isAuthenticated = isSetupCompleted ? isValidConfigPassword(configPassword) : true;

if (isSetupCompleted && !isAuthenticated) {
  // セットアップ完了時かつ未認証：エラー返却
  return c.json({ 
    error: { 
      code: 'AUTHENTICATION_REQUIRED',
      message: 'X-CONFIG header with valid config password required for setup information access'
    } 
  }, 401);
}

// セットアップ未完了時 OR 認証済み時：詳細情報を返す
const setupStatus = {
  setup: {
    isCompleted: isSetupCompleted,
    requiredFields: ['google.client_id', 'auth0.domain', 'app.config_password'],
    completedFields: getCompletedFields(),
    currentConfig: isAuthenticated ? getActualConfigValues() : getConfigFlags(),
    progress: calculateProgress(),
    nextSteps: determineNextSteps()
  },
  timestamp: new Date().toISOString()
};

return c.json(setupStatus);
```

### 7. テスト要件

#### 単体テスト
- セットアップ状態判定のテスト
- X-CONFIG認証ロジックのテスト
- JSONレスポンス構造の検証
- 進捗計算ロジックのテスト
- エラーハンドリングのテスト

#### 統合テスト
- ConfigServiceとの連携テスト
- APIルーティングの動作確認
- セットアップ状態の整合性確認

#### セキュリティテスト
- セットアップ未完了時のアクセステスト
- セットアップ完了時の認証なしアクセステスト
- 不正なX-CONFIGヘッダーでのアクセステスト
- 正しいX-CONFIGヘッダーでのアクセステスト

### 8. パフォーマンス考慮事項

#### レスポンス最適化
- 設定データの効率的な取得
- 不要なデータベースアクセスの回避
- レスポンスサイズの最小化

#### メモリ使用量
- 設定データの効率的な管理
- オブジェクト生成の最適化
- ガベージコレクションへの配慮

## 実装手順

### Phase 1: 基本構造の作成
1. `src/api/v1/setup/get.ts` ファイル作成
2. 基本的なハンドラー関数の実装
3. 型定義の作成

### Phase 2: 機能実装
1. ConfigServiceとの統合
2. X-CONFIG認証ロジックの実装
3. 認証状態に応じたレスポンス分岐
4. セットアップ状態分析ロジック
5. JSON APIレスポンスの実装

### Phase 3: エラーハンドリング
1. 各種エラーケースの処理
2. 統一エラーハンドラーとの連携
3. ログ出力の実装

### Phase 4: テスト実装
1. 単体テストの作成
2. 統合テストの作成
3. エラーケースのテスト

## 成功基準

### 機能要件
- [ ] `/api/v1/setup` エンドポイントが正常動作
- [ ] セットアップ状態の正確な判定と情報提供
- [ ] 進捗状況の適切な計算
- [ ] 次のアクション提示

### 品質要件
- [ ] 全テストが通る
- [ ] TypeScript型エラーなし
- [ ] ESLintエラーなし
- [ ] 適切なエラーハンドリング

### セキュリティ要件
- [ ] セットアップ未完了時の適切なアクセス許可
- [ ] セットアップ完了時のX-CONFIG認証実装
- [ ] 認証後の設定値提供（再セットアップ対応）
- [ ] 未認証時の機密情報保護（フラグのみ）
- [ ] 不正アクセスの適切な拒否
- [ ] セキュアなレスポンスヘッダー

### パフォーマンス要件
- [ ] レスポンス時間 < 200ms
- [ ] メモリ使用量が適切
- [ ] データベースアクセスの最適化

## 次のステップ

このタスク完了後の作業:
1. `src/api/v1/setup/post.ts` の実装
2. セットアップフォーム処理の API 化
3. フロントエンド分離の準備
4. セットアップUIの改善

## 参考情報

### 関連ファイル
- `src/setup.ts` - 既存セットアップハンドラー
- `src/services/config.ts` - 設定管理サービス
- `src/api/index.ts` - APIルーター

### 技術スタック
- **フレームワーク**: Hono
- **型システム**: TypeScript
- **テスト**: Vitest
- **設定管理**: ConfigService