# 参加アプリ

[astro-user-webauthn2](https://github.com/czbone/astro-user-webauthn2) の認証サーバーに連携する参加アプリです。ログイン、パスキー、ユーザー作成は行いません。仕様は [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md) と [multi-app-auth.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/multi-app-auth.md) です。

未ログインの画面は認証サーバーの引き渡しへ送り、`/callback` でコードを消費してホスト専用の `__Host-session` を発行します。画面の権限は `AppGrant.permission` だけを見ます。

## 画面

| パス | 内容 |
| --- | --- |
| `/` | メールアドレス、名前、権限。ログアウト |
| `/grants` | 管理者だけの付与一覧 |
| `/callback` | 引き渡しの戻り |
| `/logged-out` | ログアウト完了。ここから引き渡しは始めない |

## 動作確認

認証サーバーへ接続したあとの手順は [docs/verification.md](docs/verification.md) です。

## 権限

画面の権限とアクセス制御は [docs/access.md](docs/access.md) です。

## セットアップ

認証サーバーを `http://auth.localhost:3000` で起動し、管理者が次を登録してからこのアプリを起動します。

- `App.id` は `app`
- `origin` は `http://app.localhost:4000`
- `redirectUris` に `http://app.localhost:4000/callback`
- 利用者ごとの `AppGrant`（seed 管理者には自動で付かない）

PostgreSQL と Redis は認証サーバーと同じ場所へ、権限を絞った `app_participant` で接続します。手順は [docs/connections.md](docs/connections.md) です。このアプリはロールを作成せず、マイグレーションも実行しません。

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm dev
```

ブラウザでは `http://app.localhost:4000` を開きます。`localhost` の別ポートではホスト専用 Cookie が混ざるため、ホスト名で分けます。

## コマンド

| コマンド | 説明 |
| --- | --- |
| `pnpm dev` | `app.localhost:4000` で開発サーバーを起動 |
| `pnpm test` | 引き渡し判定のユニットテスト |
| `pnpm lint` | ESLint |
| `pnpm build` | 本番ビルド |
| `pnpm db:generate` | 読み取り用 Prisma Client の生成 |

共有テーブルの変更は認証サーバーだけが行います。`db:migrate` と `db:seed` はありません。
