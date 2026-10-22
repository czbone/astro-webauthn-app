# ライブラリ化

この資料は、参考実装の認証骨格をライブラリへ移し、以降の参加アプリがそのライブラリに依存する手順です。ライブラリを公開するまで、新しい参加アプリは [building.md](building.md) のコピー手順に従います。

プロトコルの正本は [building.md](building.md) と同じです。判定の分岐は [access.md](access.md)、接続の制限は [connections.md](connections.md)、確認は [verification.md](verification.md) と [testing.md](testing.md) です。この資料は、その表と手順を写しません。

## 分けるもの

ライブラリへ移すものと、各参加アプリに残すものを次に分けます。

| ライブラリへ移すもの | 今の場所 |
| --- | --- |
| 環境値の検証 | [src/server/env.ts](../src/server/env.ts)、[src/server/env-check.ts](../src/server/env-check.ts) |
| Cookie、引き渡し、セッション、失効、ログアウト | [src/server/auth](../src/server/auth) |
| Redis | [src/server/redis](../src/server/redis)、[src/lib/redis.ts](../src/lib/redis.ts) |
| 実効許可と共有テーブルの参照 | [src/server/auth/permission.ts](../src/server/auth/permission.ts)、[src/server/db/read.ts](../src/server/db/read.ts)、[prisma/schema.prisma](../prisma/schema.prisma)、[src/lib/prisma.ts](../src/lib/prisma.ts) |
| 入場 | [src/middleware/access.ts](../src/middleware/access.ts) |
| `/callback`、`/logged-out`、`/grants`、`/roles` | [src/pages/callback.astro](../src/pages/callback.astro)、[src/pages/logged-out.astro](../src/pages/logged-out.astro)、[src/pages/grants.astro](../src/pages/grants.astro)、[src/pages/roles.astro](../src/pages/roles.astro) |
| ヘッダ、ログアウト、権限不足 | [src/layouts/MainLayout.astro](../src/layouts/MainLayout.astro)、[src/components/LogoutForm.astro](../src/components/LogoutForm.astro)、[src/components/Denied.astro](../src/components/Denied.astro) |
| 骨格の自動テスト | `src/server` と `src/test` の、上の処理を対象にするテスト |

各参加アプリに残すものは次です。

- `APP_ID` とオリジン
- 業務画面。この参考実装では [src/pages/index.astro](../src/pages/index.astro)
- ヘッダの表示名。ライブラリの設定として渡し、画面へ直書きしない
- アプリ内ロールのスキーマと、そのスキーマだけのマイグレーション
- 業務の更新
- 仮想モジュールをライブラリへ渡す [src/fetch.ts](../src/fetch.ts)
- `App.Locals` の接続。型の定義は [src/env.d.ts](../src/env.d.ts)

パッケージ名は、ライブラリのリポジトリを作るときに決め、この資料へ追記します。

## リクエスト処理

`astro/hono` と `astro/app` は、その参加アプリのビルドが渡す仮想モジュールです。ライブラリのビルドからは import しません。各アプリの `src/fetch.ts` が import し、ライブラリの関数へ引数で渡します。

処理順は、ライブラリの関数の中で次に固定します。

1. `middleware()`
2. `POST /logout`
3. アプリが登録した更新
4. `actions()`
5. `pages()`
6. `cookieStore` に積んだ値を `Set-Cookie` にする

本番環境以外では、別ホストへの GET を `APP_ORIGIN` の同じパスとクエリへ 302 でリダイレクトします。この分岐も同じ関数に置きます。`POST /logout` の登録はライブラリが行い、アプリ側では繰り返しません。

```ts
import { App } from 'astro/app'
import { actions, middleware, pages } from 'astro/hono'
import { createParticipantFetch } from '<package>'

export default createParticipantFetch({
  App,
  middleware,
  actions,
  pages,
  mutations: [],
  routes() {}
})
```

`<package>` は、決めたパッケージ名に置き換えます。`mutations` と `routes` は、アプリ内ロールの定義があるときだけ業務の更新を加えます。

## 画面の注入

ライブラリは Astro integration で次を参加アプリへ注入します。

- `addMiddleware` で入場
- `injectRoute` で `/callback`、`/logged-out`、`/grants`、`/roles`

注入する `.astro` はパッケージのソースのまま配布し、参加アプリのビルドがコンパイルします。ヘッダの表示名は integration の設定です。この参考実装の表示名は「参加アプリ」です。

ページは `Astro.locals.access` だけを参照します。ライブラリは `PageAccess` を公開し、参加アプリの `src/env.d.ts` が `App.Locals` へ接続します。

```ts
declare namespace App {
  interface Locals {
    access: import('<package>').PageAccess
  }
}
```

画面のクラスは Tailwind CSS のままです。参加アプリの CSS は、ライブラリの `.astro` を `@source` の対象に含めます。

## 更新の拡張

入場ミドルウェアは、許可リストにある更新だけを次へ渡します。初期値は `POST /logout` だけです。それ以外の更新は、入場を確認したあと 404「見つかりません」を返します。

アプリ内ロールを定義したアプリは、業務のメソッドとパスを `mutations` に追加し、同じパスを `routes` で登録します。許可リストに無いパスは、Hono へ登録してもミドルウェアが止めます。

公開パスは `/callback` と `/logged-out`、およびファイル名に `.` を含む静的ファイルに固定します。公開パスを増やす設定は置きません。

## データ

共有4テーブルの読み取りクライアントは、ライブラリが生成します。参照は `$queryRaw` のままです。ライブラリにマイグレーションは置きません。

アプリ内ロールは、参加アプリが別の Prisma スキーマを `public` 以外に持ち、`User.id` をキーにします。そのスキーマだけを、そのアプリがマイグレーションします。接続先は同じ `DATABASE_URL` です。共有クライアントへ、アプリのモデルは足しません。

## 設定にしないこと

[building.md](building.md) の「変えないこと」は、ライブラリのオプションにしません。セッションストアの差し替え、Cookie 名の変更、新しいセッショントークン、公開パスの追加は受け付けません。Redis のコマンドと参照する列は [connections.md](connections.md) のままです。

## 依存

ライブラリの peer dependency は、切り出す時点のこのリポジトリと同じメジャーの `astro` と `hono` です。`@astrojs/node` と Tailwind CSS は参加アプリが持ちます。共有テーブルの Prisma Client、`pg`、`ioredis` はライブラリが持ちます。

## テスト

骨格のユニットテストと統合テストは、対象の処理と一緒にライブラリへ移します。接続と、統合テストが上書きする `APP_ID=app` は [testing.md](testing.md) に従い、ライブラリのテストが持ちます。参加アプリは、自分の業務画面のテストだけを持ちます。

## 手順

1. ライブラリ用のリポジトリを作り、パッケージ名を決める
2. 「分けるもの」のファイルを移し、公開口を決める
3. 入場ミドルウェアへ更新の許可リストを足す。初期値は `POST /logout` だけにする
4. Astro integration でミドルウェアと4画面を注入する。表示名は設定で渡す
5. `createParticipantFetch` を公開する。仮想モジュールは引数で受け取る
6. 共有テーブルの Prisma Client をライブラリ内で生成する。マイグレーションは置かない
7. 骨格のテストをライブラリへ移す
8. この参考実装を、ライブラリに依存する参加アプリに変える。業務画面は `/` のまま残す
9. [building.md](building.md) のコピー手順を、ライブラリへの依存に置き換える
10. [verification.md](verification.md) と [testing.md](testing.md) で確認する

## この参考実装のあと

移したファイルは、このリポジトリから削除します。`src/fetch.ts` は仮想モジュールを渡すファイルにし、[src/pages/index.astro](../src/pages/index.astro) と表示名「参加アプリ」は残します。

仕様の文章は、ライブラリを公開するまでこのリポジトリの `docs/` が正本です。公開するとき、骨格の手順はライブラリの文書へ移します。[access.md](access.md) と [connections.md](connections.md) の判定と接続は、ライブラリが実装する契約として残します。
