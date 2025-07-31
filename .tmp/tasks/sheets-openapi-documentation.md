# Sheets API OpenAPI 対応タスク

## 概要

`/api/v1/sheets` エンドポイントの OpenAPI ドキュメント対応を実装します。現在は POST メソッドのみ実装されており、システムシート（_User, _Role）の初期化機能を提供しています。

## 現状の API 構造

### 実装済みエンドポイント

#### POST /api/v1/sheets
- **目的**: シートの初期化
- **リクエストボディ**:
  ```json
  {
    "name": "SHEET_NAME"
  }
  ```
- **レスポンス**:
  - 成功 (200):
    ```json
    {
      "success": true,
      "message": "{SHEET_NAME} sheet initialized successfully",
      "sheet": "SHEET_NAME"
    }
    ```
  - エラー (400):
    ```json
    {
      "error": "Sheet name is required",
      "message": "Please provide a valid sheet name in the request body"
    }
    ```
  - エラー (500):
    ```json
    {
      "error": "Failed to initialize sheet",
      "message": "Error details..."
    }
    ```

## OpenAPI 実装計画

### 1. スキーマ定義

#### リクエストスキーマ
```typescript
// Sheet 作成リクエスト
const CreateSheetRequestSchema = z.object({
  name: z.string().openapi({
    example: 'MySheet',
    description: 'Sheet name to create or initialize'
  })
});
```

#### レスポンススキーマ
```typescript
// 成功レスポンス
const SheetSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().openapi({ example: 'MySheet sheet initialized successfully' }),
  sheet: z.string().openapi({ example: 'MySheet' })
});

// エラースキーマ
const SheetErrorSchema = z.object({
  error: z.string().openapi({ example: 'Sheet name is required' }),
  message: z.string().openapi({ example: 'Please provide a valid sheet name in the request body' })
});
```

### 2. OpenAPI ルート定義

```typescript
export const createSheetRoute = createRoute({
  method: 'post',
  path: '/v1/sheets',
  tags: ['Sheets'],
  summary: 'Create or Initialize Sheet',
  description: 'Create a new sheet or initialize a system sheet in Google Sheets',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSheetRequestSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SheetSuccessResponseSchema
        }
      },
      description: 'Sheet created or initialized successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Invalid request or unsupported sheet name'
    },
    500: {
      content: {
        'application/json': {
          schema: SheetErrorSchema
        }
      },
      description: 'Server error during sheet initialization'
    }
  }
});
```

### 3. ファイル構造

```
src/api/v1/sheets/
├── route.ts          # 既存のルート定義（OpenAPI スキーマに変更）
├── post.ts           # 既存のハンドラー（型安全性向上）
└── types.ts          # 共通の型定義（新規作成）
```

### 4. 実装手順

1. **型定義ファイルの作成** (`types.ts`)
   - リクエスト/レスポンスの型定義
   - Zod スキーマの定義

2. **ルートファイルの更新** (`route.ts`)
   - OpenAPI スキーマの追加
   - `createRoute` を使用した定義

3. **ハンドラーの型安全性向上** (`post.ts`)
   - 明示的なステータスコードの追加
   - 型定義の適用

4. **API インデックスの更新**
   - OpenAPIHono への直接マウント
   - 既存の Hono ルーターから移行

### 5. 追加タスク

#### 1. playground リダイレクトの削除
- `/api/v1/playground` のリダイレクト定義を削除
- 不要なコードのクリーンアップ

#### 2. playground への OpenAPI リンク追加
- Swagger UI へのリンク: `/api/v1/ui`
- OpenAPI JSON へのリンク: `/api/v1/doc`
- External Links セクションに追加

## 実装の優先順位

1. **高**: POST /api/v1/sheets の OpenAPI 対応
2. **中**: playground リダイレクトの削除
3. **中**: playground への OpenAPI リンク追加

## テスト項目

- [ ] POST /api/v1/sheets が OpenAPI ドキュメントに表示される
- [ ] Swagger UI で実際にリクエストを送信できる
- [ ] 既存のテストが全て通過する
- [ ] TypeScript の型チェックが通過する
- [ ] playground から Swagger UI/OpenAPI にアクセスできる

## セキュリティ考慮事項

- 認証が必要なエンドポイントかどうかの明確化
- 現状は認証なしで動作しているが、本番環境では要検討
- CSRF トークンの必要性（POST メソッド）

## 破壊的変更

なし - 既存の API 動作は維持され、ドキュメント生成のみ追加される