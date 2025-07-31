# Auth OpenAPI ドキュメント作成タスク

## 概要
`@hono/zod-openapi`を使用して`/api/v1/auth`エンドポイントの包括的なOpenAPIドキュメントを作成する。

## スコープ

- **対象エンドポイント**: 
  - GET /api/v1/auth/login
  - GET /api/v1/auth/callback
  - POST /api/v1/auth/logout
  - GET /api/v1/auth/me

## 既存エンドポイントの分析

### GET /api/v1/auth/login - OAuthログイン初期化
**目的**: ユーザー認証のためAuth0ログインページにリダイレクト

**リクエスト**: ボディ不要

**レスポンス**:
- 302: stateパラメータ付きでAuth0認証URLにリダイレクト
- 400: 認可されていないリダイレクトベースURL
- 500: 認証サービスが設定されていないか利用不可

**セキュリティ**:
- 許可されたベースに対してリダイレクトURIを検証
- CSRF stateトークンを生成
- state検証用にHTTP-only cookieを設定

### GET /api/v1/auth/callback - OAuthコールバックハンドラー
**目的**: Auth0からのOAuthコールバックを処理し、コードをトークンに交換、セッションを作成

**リクエスト**:
- クエリパラメータ:
  - `code`: Auth0からの認証コード
  - `state`: CSRF保護用state
  - `error` (オプション): Auth0エラーコード
  - `error_description` (オプション): Auth0エラー詳細

**レスポンス**:
- 200: ユーザーデータとセッション付きで認証成功
- 400: パラメータ不足、無効なstate、またはAuth0エラー
- 500: 認証処理失敗

**セキュリティ**:
- cookieに対してstateパラメータを検証
- HTTP-only cookieでセキュアなセッションを作成
- _Userシートでユーザーデータを更新

### POST /api/v1/auth/logout - ユーザーセッション終了
**目的**: セッションを破棄して現在のユーザーをログアウト

**リクエスト**:
- ヘッダー:
  - `X-Requested-With: XMLHttpRequest` (CSRF保護)
  - `Origin`または`Referer`ヘッダー必須

**レスポンス**:
- 200: ログアウト成功
- 400: 無効なリクエストヘッダーまたはオリジン
- 401: アクティブなセッションが見つからない
- 500: ログアウト処理失敗

**セキュリティ**:
- カスタムヘッダーによるCSRF保護
- オリジン検証
- タイミング攻撃緩和

### GET /api/v1/auth/me - 現在のユーザー取得
**目的**: 現在認証されているユーザーの情報を返す

**リクエスト**: ボディ不要（セッションcookieを使用）

**レスポンス**:
- 200: セッション詳細付きユーザー情報
- 401: 認証が必要またはセッション期限切れ
- 500: ユーザー情報の取得に失敗

**セキュリティ**:
- セッション検証
- 有効期限チェック
- タイミング攻撃緩和

## タスク成果物

### 1. 型定義 (`src/api/v1/auth/types.ts`)

```typescript
import { z } from '@hono/zod-openapi';

// ログインレスポンススキーマ（ドキュメント用）
export const LoginRedirectSchema = z.object({
  message: z.string().openapi({
    example: 'Auth0ログインにリダイレクト中',
    description: '情報メッセージ'
  })
});

// ログインエラースキーマ
export const LoginErrorSchema = z.object({
  error: z.string().openapi({
    example: '認可されていないリダイレクトベースURL',
    description: 'エラータイプ識別子'
  }),
  message: z.string().openapi({
    example: 'ホスト https://example.com は許可されたリダイレクトベースに含まれていません',
    description: '詳細なエラーメッセージ'
  })
});

// コールバッククエリパラメータスキーマ
export const CallbackQuerySchema = z.object({
  code: z.string().openapi({
    param: {
      name: 'code',
      in: 'query'
    },
    example: 'abc123xyz',
    description: 'Auth0からの認証コード'
  }),
  state: z.string().openapi({
    param: {
      name: 'state',
      in: 'query'
    },
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'CSRF保護用stateパラメータ'
  }),
  error: z.string().optional().openapi({
    param: {
      name: 'error',
      in: 'query'
    },
    example: 'access_denied',
    description: 'Auth0エラーコード'
  }),
  error_description: z.string().optional().openapi({
    param: {
      name: 'error_description',
      in: 'query'
    },
    example: 'ユーザーがログインフローをキャンセルしました',
    description: '人間が読めるエラー説明'
  })
});

// コールバック成功レスポンススキーマ
export const CallbackSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: '成功インジケーター'
  }),
  user: z.object({
    id: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'Auth0からの一意ユーザー識別子'
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'ユーザーメールアドレス'
    }),
    name: z.string().nullable().openapi({
      example: '田中太郎',
      description: 'ユーザー表示名'
    }),
    picture: z.string().url().nullable().openapi({
      example: 'https://avatars.example.com/user.jpg',
      description: 'ユーザープロフィール画像URL'
    }),
    created_at: z.string().openapi({
      example: '2024-01-01T00:00:00.000Z',
      description: 'ユーザー作成タイムスタンプ'
    }),
    last_login: z.string().openapi({
      example: '2024-01-15T12:00:00.000Z',
      description: '最終ログインタイムスタンプ'
    })
  }).openapi({
    description: 'ユーザー情報'
  }),
  session: z.object({
    session_id: z.string().openapi({
      example: 'sess_550e8400-e29b-41d4-a716-446655440000',
      description: 'セッション識別子'
    }),
    expires_at: z.string().openapi({
      example: '2024-01-16T12:00:00.000Z',
      description: 'セッション有効期限タイムスタンプ'
    })
  }).openapi({
    description: 'セッション情報'
  }),
  authenticated: z.literal(true).openapi({
    description: '認証ステータス'
  })
});

// コールバックエラーレスポンススキーマ
export const CallbackErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: '成功インジケーター'
  }),
  error: z.string().openapi({
    example: 'invalid_state',
    description: 'エラーコード'
  }),
  message: z.string().openapi({
    example: '無効なstateパラメータ',
    description: 'エラーメッセージ'
  }),
  authenticated: z.literal(false).openapi({
    description: '認証ステータス'
  })
});

// ログアウトリクエストヘッダースキーマ
export const LogoutHeadersSchema = z.object({
  'X-Requested-With': z.literal('XMLHttpRequest').openapi({
    param: {
      name: 'X-Requested-With',
      in: 'header'
    },
    description: 'CSRF保護ヘッダー'
  }),
  Origin: z.string().url().optional().openapi({
    param: { name: 'Origin', in: 'header' },
    description: 'CSRF / オリジン検証に使用されるOriginヘッダー'
  }),
  Referer: z.string().url().optional().openapi({
    param: { name: 'Referer', in: 'header' },
    description: 'CSRF / オリジン検証に使用されるRefererヘッダー'
  })
}).refine(h => h.Origin || h.Referer, {
  message: 'OriginまたはRefererヘッダーのいずれかが必要です'
});

// ログアウト成功レスポンススキーマ
export const LogoutSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: '成功インジケーター'
  }),
  message: z.string().openapi({
    example: 'ログアウトに成功しました',
    description: '成功メッセージ'
  })
});

// ログアウトエラーレスポンススキーマ
export const LogoutErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: '成功インジケーター'
  }),
  error: z.string().openapi({
    example: 'invalid_request',
    description: 'エラーコード'
  }),
  message: z.string().openapi({
    example: '無効なリクエストヘッダー',
    description: 'エラーメッセージ'
  })
});

// Me成功レスポンススキーマ
export const MeSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: '成功インジケーター'
  }),
  user: z.object({
    id: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'Auth0 subクレームからのユーザーID'
    }),
    name: z.string().nullable().openapi({
      example: '田中太郎',
      description: 'ユーザー表示名'
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'ユーザーメールアドレス'
    }),
    picture: z.string().url().nullable().openapi({
      example: 'https://avatars.example.com/user.jpg',
      description: 'ユーザープロフィール画像URL'
    }),
    email_verified: z.boolean().openapi({
      example: true,
      description: 'メール検証ステータス'
    }),
    updated_at: z.string().openapi({
      example: '2024-01-15T10:00:00.000Z',
      description: 'ユーザー最終更新タイムスタンプ'
    }),
    iss: z.string().openapi({
      example: 'https://auth.example.com/',
      description: 'トークン発行者'
    }),
    aud: z.string().openapi({
      example: 'abc123',
      description: 'トークンオーディエンス'
    }),
    iat: z.number().openapi({
      example: 1704067200,
      description: 'トークン発行時刻タイムスタンプ'
    }),
    exp: z.number().openapi({
      example: 1704153600,
      description: 'トークン有効期限タイムスタンプ'
    }),
    sub: z.string().openapi({
      example: 'auth0|507f1f77bcf86cd799439011',
      description: 'サブジェクト（ユーザーID）'
    }),
    sid: z.string().openapi({
      example: 'session123',
      description: 'Auth0からのセッションID'
    })
  }).openapi({
    description: 'セッションからのユーザー情報'
  }),
  session: z.object({
    session_id: z.string().openapi({
      example: 'sess_550e8400-e29b-41d4-a716-446655440000',
      description: 'セッション識別子'
    }),
    expires_at: z.string().openapi({
      example: '2024-01-16T12:00:00.000Z',
      description: 'セッション有効期限タイムスタンプ'
    }),
    created_at: z.string().openapi({
      example: '2024-01-15T12:00:00.000Z',
      description: 'セッション作成タイムスタンプ'
    })
  }).openapi({
    description: 'セッションメタデータ'
  })
});

// Meエラーレスポンススキーマ
export const MeErrorSchema = z.object({
  success: z.literal(false).openapi({
    description: '成功インジケーター'
  }),
  error: z.string().openapi({
    example: 'unauthorized',
    description: 'エラーコード'
  }),
  message: z.string().openapi({
    example: '認証が必要です',
    description: 'エラーメッセージ'
  })
});

// スキーマから派生したTypeScript型
export type LoginRedirectResponse = z.infer<typeof LoginRedirectSchema>;
export type LoginErrorResponse = z.infer<typeof LoginErrorSchema>;
export type CallbackQuery = z.infer<typeof CallbackQuerySchema>;
export type CallbackSuccessResponse = z.infer<typeof CallbackSuccessSchema>;
export type CallbackErrorResponse = z.infer<typeof CallbackErrorSchema>;
export type LogoutHeaders = z.infer<typeof LogoutHeadersSchema>;
export type LogoutSuccessResponse = z.infer<typeof LogoutSuccessSchema>;
export type LogoutErrorResponse = z.infer<typeof LogoutErrorSchema>;
export type MeSuccessResponse = z.infer<typeof MeSuccessSchema>;
export type MeErrorResponse = z.infer<typeof MeErrorSchema>;
```

### 2. OpenAPIルート定義 (`src/api/v1/auth/route.ts`)

```typescript
import { createRoute } from '@hono/zod-openapi';
import {
  LoginRedirectSchema,
  LoginErrorSchema,
  CallbackQuerySchema,
  CallbackSuccessSchema,
  CallbackErrorSchema,
  LogoutHeadersSchema,
  LogoutSuccessSchema,
  LogoutErrorSchema,
  MeSuccessSchema,
  MeErrorSchema
} from './types';

/**
 * ログインエンドポイントのOpenAPIルート定義
 */
export const loginRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/login',
  tags: ['認証'],
  summary: 'OAuthログイン初期化',
  description: 'ユーザー認証のためAuth0ログインページにリダイレクト。CSRF state cookieを設定。',
  responses: {
    302: {
      description: 'Auth0認証URLにリダイレクト',
      headers: {
        Location: {
          schema: {
            type: 'string',
            example: 'https://auth.example.com/authorize?client_id=...'
          }
        },
        'Set-Cookie': {
          schema: {
            type: 'string',
            example: 'auth_state=uuid; HttpOnly; SameSite=Lax; Max-Age=600'
          }
        }
      }
    },
    400: {
      content: {
        'application/json': {
          schema: LoginErrorSchema
        }
      },
      description: '認可されていないリダイレクトベースURL'
    },
    500: {
      content: {
        'application/json': {
          schema: LoginErrorSchema
        }
      },
      description: '認証サービスが設定されていないか利用不可'
    }
  }
});

/**
 * OAuthコールバックのOpenAPIルート定義
 */
export const callbackRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/callback',
  tags: ['認証'],
  summary: 'OAuthコールバックハンドラー',
  description: 'Auth0からのOAuthコールバックを処理し、認証コードをトークンに交換してユーザーセッションを作成',
  request: {
    query: CallbackQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CallbackSuccessSchema
        }
      },
      description: '認証成功'
    },
    400: {
      content: {
        'application/json': {
          schema: CallbackErrorSchema
        }
      },
      description: '不正リクエスト - パラメータ不足、無効なstate、またはAuth0エラー'
    },
    500: {
      content: {
        'application/json': {
          schema: CallbackErrorSchema
        }
      },
      description: '認証処理失敗'
    }
  }
});

/**
 * ログアウトのOpenAPIルート定義
 */
export const logoutRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['認証'],
  summary: 'ユーザーセッション終了',
  description: 'セッションを破棄して現在のユーザーをログアウト。CSRF保護ヘッダーが必要。',
  request: {
    headers: LogoutHeadersSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LogoutSuccessSchema
        }
      },
      description: 'ログアウト成功'
    },
    400: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: '無効なリクエストヘッダーまたはオリジン'
    },
    401: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: 'アクティブなセッションが見つからない'
    },
    500: {
      content: {
        'application/json': {
          schema: LogoutErrorSchema
        }
      },
      description: 'ログアウト処理失敗'
    }
  }
});

/**
 * 現在のユーザーエンドポイントのOpenAPIルート定義
 */
export const meRoute = createRoute({
  method: 'get',
  path: '/api/v1/auth/me',
  tags: ['認証'],
  summary: '現在のユーザー取得',
  description: 'セッションcookieに基づいて現在認証されているユーザーの情報を返す',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeSuccessSchema
        }
      },
      description: 'ユーザー情報の取得に成功'
    },
    401: {
      content: {
        'application/json': {
          schema: MeErrorSchema
        }
      },
      description: '認証が必要またはセッション期限切れ'
    },
    500: {
      content: {
        'application/json': {
          schema: MeErrorSchema
        }
      },
      description: 'ユーザー情報の取得に失敗'
    }
  }
});

// 将来のルート定義
// export const refreshRoute = createRoute({ ... }); // トークンリフレッシュエンドポイント
// export const revokeRoute = createRoute({ ... }); // トークン失効エンドポイント
```

## 実装ノート

### 認証フロー
1. **ログイン**: ユーザーがログイン開始 → Auth0にリダイレクト → State cookieを設定
2. **コールバック**: Auth0がリダイレクトバック → stateを検証 → コードをトークンに交換 → セッション作成
3. **セッション**: セッションはHTTP-only cookieでD1データベースに保存
4. **ログアウト**: CSRFヘッダーを検証 → セッション削除 → cookieクリア

### セキュリティ考慮事項
1. **CSRF保護**: OAuthフロー用stateパラメータ、ログアウト用カスタムヘッダー
2. **Cookieセキュリティ**: HTTP-only、Secure（HTTPS）、SameSite属性
3. **オリジン検証**: 機密操作でOrigin/Refererヘッダーをチェック
4. **タイミング攻撃緩和**: 認証操作で一貫したレスポンス時間
5. **セッション管理**: 有効期限付きサーバーサイドセッション

### エラーハンドリング
1. **OAuthエラー**: Auth0エラーレスポンスを適切に処理
2. **バリデーションエラー**: 不足/無効なパラメータに対する明確なメッセージ
3. **サービスエラー**: Auth0が利用不可時の優雅な劣化
4. **セッションエラー**: 期限切れセッションの適切なクリーンアップ

### データストレージ
- **セッション**: D1データベースセッションテーブル
- **ユーザーデータ**: Google Sheetsの_Userシート（UserSheetサービス経由）
- **Cookie**: HTTP-only session_idと一時的なauth_state

## テスト要件

- 現状のテストがすべて通ること
- TypeScriptエラーが出ないこと
