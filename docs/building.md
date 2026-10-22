# 参加アプリの作り方

このリポジトリは、認証サーバーに連携する参加アプリの参考実装です。新しい参加アプリは、このリポジトリをコピーし、識別子と業務画面を置き換えます。認証の骨格は残します。

手順は次です。

1. このリポジトリをコピーする
2. 認証サーバーへアプリを登録する
3. `APP_ID` とオリジンを変える
4. 認証の骨格を残す
5. 業務画面を置き換える
6. [verification.md](verification.md) と [testing.md](testing.md) で確認する

## 位置づけ

プロトコルの正本は、認証サーバーの [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md)、[multi-app-auth.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/multi-app-auth.md)、[app-permissions](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/app-permissions/README.md)、[ロールと認可](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/auth-app-role-authorization-spec.md) です。

このアプリの画面と確認方法は `docs/` に記載しています。作るものの仕様が食い違う場合は `docs/` に従います。権限の決め方が食い違う場合は [grant.md](../planning/app-permissions/grant.md) に従います。

判定の分岐は [access.md](access.md)、接続の制限は [connections.md](connections.md) です。この手引きは、その表と手順を写しません。

## 境界

参加アプリが担う機能は次のとおりです。

- 未ログイン時に `{AUTH_ORIGIN}/auth/handoff` へ送る引き渡し
- `/callback` でコードを消費し、ホスト専用の `__Host-session` を発行する処理
- 実効許可が `allow` の場合に限った入場
- `POST /logout`
- 共有テーブルの参照

参加アプリが担わない機能は次のとおりです。

- ログイン、パスキー儀式、メール、ユーザー作成
- `App` と `AppGrant` の作成と変更
- 公開パス。未ログインの画面は本文を出さない
- 認証サーバーの HTTP 呼び出し

## 認証サーバーへの登録と環境

アプリを起動する前に、認証サーバーの管理画面で登録します。

| 項目 | 値 |
| --- | --- |
| アプリ ID | `APP_ID` と同一 |
| オリジン | `APP_ORIGIN`。パスは含めない |
| 戻り先 URL | `APP_ORIGIN/callback` |
| 既定の利用許可 | `allow`、または行が無い利用者を入れない設定 |

コピー後に変更する値は、[.env.example](../.env.example) の `APP_ID` と `APP_ORIGIN` です。`AUTH_ORIGIN` は認証サーバーのオリジンのままにします。これら2つのオリジンには、それぞれ異なる値を設定します。ホスト専用 Cookie はポート番号では分離されないため、`localhost` の別ポートではなく、別のホスト名を使います。

`APP_ID` は [src/server/env.ts](../src/server/env.ts) の `^[a-z0-9-]{1,32}$` です。

PostgreSQL と Redis の接続文字列、許す操作、`REDIS_KEY_PREFIX` と `SESSION_MAX_AGE_SECONDS` は [connections.md](connections.md) です。起動コマンドはリポジトリの [README](../README.md) です。共有テーブルのロール作成とマイグレーションは、このアプリでは実行しません。

## 残す骨格

リクエスト処理の順序は [src/fetch.ts](../src/fetch.ts) で定義しています。`middleware()`、`POST /logout`、`actions()`、`pages()` の順序を変えないでください。本番環境以外では、別ホストへの GET を `APP_ORIGIN` の同じパスとクエリへ 302 でリダイレクトします。カスタム fetch では Node アダプターが `Set-Cookie` を付与しないため、Cookie は `cookieStore` に蓄積し、レスポンス時に `Set-Cookie` ヘッダーへ反映します。

分岐の一覧は [access.md](access.md) です。ファイルの対応は次です。

| 残すもの | 場所 |
| --- | --- |
| リクエストの順と `Set-Cookie` | [src/fetch.ts](../src/fetch.ts) |
| 入場 | [src/middleware/access.ts](../src/middleware/access.ts) |
| 引き渡しの開始と消費 | [src/server/auth/handoff.ts](../src/server/auth/handoff.ts)、[src/pages/callback.astro](../src/pages/callback.astro) |
| セッション解決 | [src/server/auth/access.ts](../src/server/auth/access.ts) |
| ログアウト | [src/server/auth/logout.ts](../src/server/auth/logout.ts)、[src/pages/logged-out.astro](../src/pages/logged-out.astro) |
| 共有テーブルの参照 | [prisma/schema.prisma](../prisma/schema.prisma)、[src/server/db/read.ts](../src/server/db/read.ts) |

## 置き換えるもの

[src/pages/index.astro](../src/pages/index.astro) の本文と、[src/layouts/MainLayout.astro](../src/layouts/MainLayout.astro) のヘッダの表示名を、そのアプリのものに変えます。`/grants` と `/roles` は権限仕様の画面なので残します。分け方は [access.md](access.md) です。

業務画面は `src/pages` に追加し、Astro のサーバー側で HTML を描画します。ページでは `Astro.locals.access` だけを参照し、セッションの再解決処理は書きません。`kind` が `public` の場合は権限が解決されていないため、エラーにします。

```astro
---
const access = Astro.locals.access
if (access.kind === 'public') throw new Error('画面の権限が解決されていません')
---
```

入場後の画面分けは、サーバーが読んだ `User.role` と、後から足すアプリ内ロールで行います。クライアントが送ったロール名では分けません。`kind` が `ok` のときだけ業務を出します。入場できたあとの 403 でも、セッションの TTL は延ばします。

新しい画面は公開パスにしません。`/callback` と `/logged-out` 以外の GET と HEAD は、未ログインなら引き渡しを始めます。

## 更新を足すとき

更新処理は [src/fetch.ts](../src/fetch.ts) の Hono に、`POST /logout` と同じ位置へ追加します。`/api` と `src/pages/api` は使いません。

`Origin` が `APP_ORIGIN` と完全に一致する場合だけ受け付けます。未認証の更新には 401「ログインが必要です」を返します。引き渡しは開始しません。

[src/middleware/access.ts](../src/middleware/access.ts) は、入場を確認したあと、ログアウト以外の更新に 404「見つかりません」を返します。アプリ内ロールの定義がない間、受け付ける更新は `POST /logout` だけです。定義を追加したあと、その業務に必要な更新処理だけを 404 の対象から除外します。

アプリ内ロールは、`public` 以外のスキーマに `User.id` をキーにして置きます。そのスキーマだけ、このアプリがマイグレーションします。`AppGrant` には書きません。

## 変えないこと

- Cookie 名は `__Host-session` と `__Host-handoff` です。どちらも `Domain` を付けません
- セッション Cookie の値は、引き渡し JSON の `token` だけです。新しいセッショントークンは作りません
- 引き渡しコードの消費は `GETDEL` です
- `state` と `redirectUri` は定数時間で比較します
- Redis の操作は `GET`、`GETDEL`、`EXPIRE`、`DEL`、`SREM`、`SMEMBERS` だけです
- `User.role` は入場に使いません。入場後の画面分けに読みます

## 確認

登録したあとの手動確認は [verification.md](verification.md)、自動テストは [testing.md](testing.md) です。

`APP_ID` やオリジンを変えたアプリは、統合テストが上書きする `APP_ID=app` などの値を、そのアプリの値に合わせます。定数は [src/test/integration-env.ts](../src/test/integration-env.ts) です。
