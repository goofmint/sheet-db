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

public/statics/playground/
├── style.css           # スタイルシート（既存）
└── app.js             # JavaScript 機能（既存）
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

#### 2.2 style.css (public/statics/playground/)
- 既存のファイルをそのまま利用
- `/statics/playground/style.css` パスでアクセス
- CSS変数やモダンなCSS機能を活用

#### 2.3 app.js (public/statics/playground/)
- 既存のファイルをそのまま利用
- `/statics/playground/app.js` パスでアクセス

### 4. 実装手順

#### Phase 1: ファイル構造準備
1. `src/playground/` ディレクトリ作成
2. `src/playground/route.ts` 作成（Hono ルーター）
3. `src/playground/get.ts` 作成（ハンドラー移植）

#### Phase 2: テンプレート分離
1. `src/templates/playground.tsx` 作成
2. HTML 構造を TSX コンポーネントに変換
3. プロパティインターフェース定義

#### Phase 3: スタイル確認
1. `public/statics/playground/style.css` の既存ファイルを確認
2. 必要に応じて CSS の最適化

#### Phase 4: スクリプト確認
1. `public/statics/playground/app.js` の既存ファイルを確認
2. 必要に応じて JavaScript の最適化

#### Phase 5: 静的ファイル配信確認
1. `/statics/playground/style.css` パスでの CSS 配信確認
2. `/statics/playground/app.js` パスでの JavaScript 配信確認

### 5. 技術的考慮事項

#### 5.1 TSX テンプレート
- `src/templates/playground.tsx` に配置
- Hono の `html` テンプレート機能と互換性を保持
- サーバーサイドレンダリング（SSR）として動作
- React は使用しない（ランタイム不要）
- ファイル名は小文字のみ使用

#### 5.2 CSS 配信
- `public/statics/playground/style.css` に既存配置
- `/statics/playground/style.css` パスでアクセス
- Cloudflare Workers での静的ファイル配信
- 適切なキャッシュヘッダー設定
- MIME タイプの正確な設定

#### 5.3 JavaScript 配信
- `public/statics/playground/app.js` に既存配置
- `/statics/playground/app.js` パスでアクセス
- 従来の script タグ対応
- ブラウザ互換性の確保

### 7. テスト計画

#### 7.1 既存機能のテスト
- GET `/playground` でのアクセス確認
- 認証フローの動作確認

#### 7.2 新しい構造のテスト
- TSX コンポーネントの正しいレンダリング
- CSS の適切な読み込み
- JavaScript 機能の正常動作

### 8. 完了基準

- [ ] `/playground` でアクセス可能
- [ ] HTML/CSS/JavaScript が適切に分離されている
- [ ] すべての既存機能が正常動作
- [ ] コードの可読性とメンテナンス性が向上
- [ ] 型安全性が確保されている
- [ ] テストが全て通過

## 次のステップ

このドキュメントをレビューした後、実装に着手します。各 Phase を順次実行し、段階的に機能を移行していきます。