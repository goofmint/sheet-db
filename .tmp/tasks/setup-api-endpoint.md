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
- **レスポンス形式**: HTML または JSON（Accept ヘッダーに基づく）

#### レスポンス内容
```typescript
interface SetupResponse {
  // HTML レスポンスの場合
  html: string;
  
  // JSON レスポンスの場合
  setup: {
    isCompleted: boolean;
    requiredFields: string[];
    currentConfig: {
      googleClientId?: string;
      auth0Domain?: string;
      // 他の設定項目
    };
    nextSteps: string[];
  };
  timestamp: string;
}
```

### 3. 技術仕様

#### HTMLテンプレート統合
- 既存の`src/setup.ts`のHTMLテンプレートを活用
- コードの重複を避けるための共通化
- レスポンシブデザインの維持

#### 設定状態の確認
- `ConfigService`を使用した設定状態の取得
- セットアップ完了状態の判定
- 必要な設定項目の一覧化

#### エラーハンドリング
- 設定読み込みエラーの適切な処理
- データベース接続エラーの処理
- 統一エラーハンドラーとの連携

### 4. セキュリティ考慮事項

#### 機密情報の保護
- 設定値の機密情報は非表示
- APIキーやシークレットの露出防止
- 部分的な設定情報のみ表示

#### アクセス制御
- セットアップ完了前のみアクセス可能
- 完了後は適切なリダイレクト処理
- 不正アクセスの防止

### 5. 既存システムとの連携

#### 既存ルートとの関係
- `/setup` (既存) - レガシーサポート継続
- `/api/v1/setup` (新規) - API統一インターフェース
- 両方のエンドポイントの一貫性維持

#### ConfigServiceとの統合
```typescript
// 設定状態の確認例
const isSetupCompleted = ConfigService.getBoolean('app.setup_completed', false);
const googleClientId = ConfigService.getString('google.client_id');
const auth0Domain = ConfigService.getString('auth0.domain');
```

### 6. API設計パターン

#### RESTful設計
- リソース指向の設計
- 適切なHTTPステータスコード使用
- 標準的なHTTPヘッダー活用

#### Content Negotiation
```typescript
// Accept ヘッダーに基づくレスポンス切り替え
const acceptHeader = c.req.header('Accept');
if (acceptHeader?.includes('application/json')) {
  return c.json(setupData);
} else {
  return c.html(setupHtml);
}
```

### 7. テスト要件

#### 単体テスト
- セットアップ状態判定のテスト
- HTMLレスポンスの検証
- JSONレスポンスの検証
- エラーハンドリングのテスト

#### 統合テスト
- 既存`/setup`エンドポイントとの整合性
- ConfigServiceとの連携テスト
- APIルーティングの動作確認

### 8. パフォーマンス考慮事項

#### レスポンス最適化
- HTMLテンプレートのキャッシュ化
- 設定データの効率的な取得
- 不要なデータベースアクセスの回避

#### メモリ使用量
- テンプレートの効率的な管理
- 大きなHTMLコンテンツの処理
- ガベージコレクションへの配慮

## 実装手順

### Phase 1: 基本構造の作成
1. `src/api/v1/setup/get.ts` ファイル作成
2. 基本的なハンドラー関数の実装
3. 型定義の作成

### Phase 2: 機能実装
1. ConfigServiceとの統合
2. HTMLテンプレートの統合
3. JSON APIレスポンスの実装

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
- [ ] HTML と JSON 両方のレスポンスに対応
- [ ] セットアップ状態の正確な判定
- [ ] 既存 `/setup` との一貫性維持

### 品質要件
- [ ] 全テストが通る
- [ ] TypeScript型エラーなし
- [ ] ESLintエラーなし
- [ ] 適切なエラーハンドリング

### セキュリティ要件
- [ ] 機密情報の適切な保護
- [ ] 不正アクセスの防止
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