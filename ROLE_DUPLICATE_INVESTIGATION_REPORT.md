# _Roleシート重複調査レポート

## 調査概要
GoogleスプレッドシートベースのSheet DBシステムにおいて、_Roleシートのnameフィールドの重複チェック機能の有無と、既存データの重複状況を調査した。

## 調査結果

### 1. 現在のAPI実装状況

**ファイル**: `src/index.ts` (1536-1667行目)  
**エンドポイント**: `POST /api/roles`

#### 発見事項
- ❌ **重複チェック機能なし**: nameフィールドの重複チェック処理は実装されていない
- ❌ **直接append操作**: 既存データの確認なしで直接Google Sheetsにデータを追加
- ✅ **基本バリデーション**: name必須チェックとtrim処理のみ実装

#### コード詳細
```typescript
// 1568-1573行目: nameパラメータの検証
if (!name || typeof name !== 'string' || name.trim() === '') {
  return c.json({
    success: false,
    error: 'Role name is required and must be a non-empty string'
  }, 400);
}

// 1614-1625行目: 重複チェックなしで直接append
const appendResponse = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A:K:append?valueInputOption=RAW`,
  {
    method: 'POST',
    // ...
  }
);
```

### 2. スキーマ定義確認

**ファイル**: `src/sheet-schema.ts` (64-77行目)

#### _Roleスキーマ
```typescript
{
  name: '_Role',
  columns: [
    { name: 'name', type: 'string' },        // ← ユニーク制約なし
    { name: 'users', type: 'array' },
    { name: 'roles', type: 'array' },
    { name: 'created_at', type: 'datetime' },
    { name: 'updated_at', type: 'datetime' },
    { name: 'public_read', type: 'boolean' },
    { name: 'public_write', type: 'boolean' },
    { name: 'role_read', type: 'array' },
    { name: 'role_write', type: 'array' },
    { name: 'user_read', type: 'array' },
    { name: 'user_write', type: 'array' }
  ]
}
```

#### 問題点
- nameフィールドにユニーク制約が定義されていない
- Google Sheetsにはネイティブなユニーク制約機能がない
- アプリケーションレベルでの制約実装が必要

### 3. 潜在的なリスク

1. **データ整合性の問題**
   - 同一名のロールが複数作成される可能性
   - 権限管理の混乱
   - データ検索・更新時の曖昧性

2. **運用上の問題**
   - 重複ロールによる管理コストの増加
   - ユーザー体験の低下
   - データクリーンアップの必要性

3. **セキュリティ上の懸念**
   - 意図しない権限付与の可能性
   - アクセス制御の複雑化

## 解決策の提案

### 即座の対応（推奨）

#### 1. 重複チェック機能の追加
```typescript
// POST /api/roles エンドポイントに追加
const existingRoles = await getRoleNames(spreadsheetId, tokens.access_token);
if (existingRoles.includes(name.trim())) {
  return c.json({
    success: false,
    error: `Role with name "${name.trim()}" already exists`
  }, 409); // 409 Conflict
}
```

#### 2. ヘルパー関数の実装
```typescript
async function getRoleNames(spreadsheetId: string, accessToken: string): Promise<string[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_Role!A:A`,
    { /* headers */ }
  );
  const data = await response.json();
  const values = data.values || [];
  
  return values.slice(2) // 3行目以降（ヘッダー・型定義を除く）
    .map(row => row[0])
    .filter(name => name && name.trim() !== '');
}
```

#### 3. 既存データ調査用エンドポイント
```typescript
app.get('/api/roles/investigate', async (c) => {
  // 既存の_Roleシートデータを分析
  // 重複の検出と報告
});
```

### 長期的な対応

#### 1. 複合ユニーク制約
- `user_id + name` の組み合わせでのユニーク制約
- 同一ユーザーによる重複ロール名防止

#### 2. データベース移行検討
- より堅牢なデータ整合性が必要な場合
- PostgreSQL、MySQLなどのRDBMS検討

#### 3. バリデーション強化
- フロントエンド側での事前チェック
- より詳細なネーミングルール実装

## 実装手順

1. `getRoleNames()` ヘルパー関数を `src/index.ts` に追加
2. `POST /api/roles` エンドポイントに重複チェックロジックを追加
3. `GET /api/roles/investigate` エンドポイントを追加して既存データを調査
4. 必要に応じて重複データのクリーンアップ実行
5. テストケースの作成と実行

## テスト方法

### 既存データ調査
```bash
curl -X GET 'http://localhost:8787/api/roles/investigate' \
  -H 'Authorization: Bearer <session-id>'
```

### 重複チェック機能テスト
```bash
# 1. 最初のロール作成（成功）
curl -X POST 'http://localhost:8787/api/roles' \
  -H 'Authorization: Bearer <session-id>' \
  -H 'Content-Type: application/json' \
  -d '{"name": "test-role", "public_read": false, "public_write": false}'

# 2. 同名ロール作成（409エラーが期待される）
curl -X POST 'http://localhost:8787/api/roles' \
  -H 'Authorization: Bearer <session-id>' \
  -H 'Content-Type: application/json' \
  -d '{"name": "test-role", "public_read": false, "public_write": false}'
```

## 推奨実装優先度

1. **高** - `POST /api/roles` への重複チェック追加
2. **中** - `GET /api/roles/investigate` 調査エンドポイント
3. **低** - 重複データ削除機能（必要に応じて）

## 注意事項

- Google Sheets APIのレート制限を考慮した実装が必要
- 既存データに重複がある場合の移行戦略を検討
- パフォーマンス影響を最小限に抑える設計

---

**調査実施日**: 2025-07-06  
**対象ファイル**: `src/index.ts`, `src/sheet-schema.ts`  
**調査範囲**: Role API実装、スキーマ定義、重複チェック機能