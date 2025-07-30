# Playground リファクタリングタスク

## 概要

現在の `/api/v1/playground` エンドポイントは HTML を返すため、API として適切ではありません。ファイル構造を整理し、HTML/CSS/JavaScript を適切に分離してメンテナンス性を向上させます。

## 現状の問題点

1. **API パスの不適切な使用**
   - `src/api/v1/playground` が HTML を返している（API エンドポイントではない）
   - API 名前空間の汚染

2. **ファイル配置の問題**
   - `src/api/v1/playground/` に配置されている（API ではないのに API フォルダにある）

3. **コードの分離不足**
   - HTML/CSS/JavaScript がすべて TypeScript ファイル内に埋め込まれている
   - メンテナンス性が低い
   - 再利用性が低い

## リファクタリング計画

### 1. ファイル構造の変更

#### 移動前
```
src/api/v1/playground/
├── route.ts
└── get.ts
```

#### 移動後
```
src/playground/
├── route.ts              # ルート定義
└── get.ts               # ハンドラー実装

src/templates/
└── playground.tsx       # メインページコンポーネント

public/static/playground/
├── style.css           # スタイルシート
└── app.js             # JavaScript 機能
```

### 2. ファイル分離計画

#### 2.1 playground.tsx (src/templates/)
- React JSX ライクな TSX 構文を使用
- HTML 構造を TypeScript コンポーネントとして定義
- プロパティベースでデータを受け取り
- 型安全性を確保

```typescript
interface PlaygroundProps {
  auth: AuthData | null;
  sheetId: string | null;
  storageType: string;
  baseUrl: string;
}

export function playground(props: PlaygroundProps): string;
```

#### 2.2 style.css (public/static/playground/)
- 現在 `/statics/playground/style.css` として外部参照されているスタイル
- 同じパス `/statics/playground/style.css` でアクセス可能
- CSS変数やモダンなCSS機能を活用

#### 2.3 app.js (public/static/playground/)
- 現在 `/statics/playground/app.js` として外部参照されているスクリプト
- 同じパス `/statics/playground/app.js` でアクセス可能
- API テスト機能の実装
- TypeScript で型安全に実装後、JavaScript にトランスパイル

### 4. 実装手順

#### Phase 1: ファイル構造準備
1. `src/playground/` ディレクトリ作成
2. `src/playground/route.ts` 作成（Hono ルーター）
3. `src/playground/get.ts` 作成（ハンドラー移植）

#### Phase 2: テンプレート分離
1. `src/templates/playground.tsx` 作成
2. HTML 構造を TSX コンポーネントに変換
3. プロパティインターフェース定義

#### Phase 3: スタイル分離
1. `public/static/playground/style.css` 作成
2. 既存の CSS を移植・整理
3. CSS 変数とモダンな記法に更新

#### Phase 4: スクリプト分離
1. `public/static/playground/app.js` 作成
2. JavaScript 機能を実装
3. API テスト機能の改善

#### Phase 5: ルーティング統合
1. メインアプリケーションのルーティングを更新
2. `/api/v1/playground` から `/playground` に変更
3. 既存の API ルーターから playground を除外

#### Phase 6: 静的ファイル配信確認
1. `/statics/playground/style.css` パスでの CSS 配信確認
2. `/statics/playground/app.js` パスでの JavaScript 配信確認
3. Cloudflare Workers の静的ファイル配信設定確認

### 5. 技術的考慮事項

#### 5.1 TSX テンプレート
- `src/templates/playground.tsx` に配置
- Hono の `html` テンプレート機能と互換性を保持
- サーバーサイドレンダリング（SSR）として動作
- React は使用しない（ランタイム不要）
- ファイル名は小文字のみ使用

#### 5.2 CSS 配信
- `public/static/playground/style.css` に配置
- `/statics/playground/style.css` パスでアクセス
- Cloudflare Workers での静的ファイル配信
- 適切なキャッシュヘッダー設定
- MIME タイプの正確な設定

#### 5.3 JavaScript 配信
- `public/static/playground/app.js` に配置
- `/statics/playground/app.js` パスでアクセス
- 従来の script タグ対応
- ブラウザ互換性の確保

### 6. 後方互換性

#### リダイレクト対応
```typescript
// 旧URLからの自動リダイレクト
app.get('/api/v1/playground', (c) => {
  return c.redirect('/playground', 301);
});
```

### 7. テスト計画

#### 7.1 既存機能のテスト
- すべての API テスト機能が動作することを確認
- 認証フローの動作確認
- ファイルアップロード機能の動作確認

#### 7.2 新しい構造のテスト
- TSX コンポーネントの正しいレンダリング
- CSS の適切な読み込み
- JavaScript 機能の正常動作

### 8. 完了基準

- [ ] `/playground` でアクセス可能
- [ ] `/api/v1/playground` は適切にリダイレクト
- [ ] HTML/CSS/JavaScript が適切に分離されている
- [ ] すべての既存機能が正常動作
- [ ] コードの可読性とメンテナンス性が向上
- [ ] 型安全性が確保されている
- [ ] テストが全て通過

## 推定作業時間

- Phase 1: 1時間
- Phase 2: 2時間
- Phase 3: 1時間
- Phase 4: 2時間
- Phase 5: 1時間
- Phase 6: 1時間
- テスト・調整: 2時間

**合計: 約10時間**

## リスク要因

1. **静的ファイル配信の複雑さ**
   - Cloudflare Workers での CSS/JS 配信設定
   - 適切なルーティング設定

2. **TSX コンポーネントの複雑さ**
   - Hono での TSX サポート確認が必要
   - サーバーサイドレンダリングの実装

3. **既存機能の破損リスク**
   - 大きな構造変更によるバグの可能性
   - 十分なテストが必要

## 次のステップ

このドキュメントをレビューした後、実装に着手します。各 Phase を順次実行し、段階的に機能を移行していきます。