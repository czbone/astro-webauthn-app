# 接続

参加アプリは、認証サーバーと同じ PostgreSQL と Redis に接続します。接続文字列のホストとデータベース名は認証サーバーと同じです。ユーザーとパスワードは、読み書きできる認証サーバー用とは別にします。

このアプリはロールを作らず、マイグレーションも実行しません。`db:migrate` と `db:seed` はありません。

## PostgreSQL

管理者が、認証サーバーと同じデータベースへロール `app_participant` を一度作ります。アプリを増やすたびにロールは作りません。ひな型は認証サーバーの [participant-access.sql](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant/participant-access.sql) です。`CREATE ROLE` と `GRANT` はコメントアウトされているので、データベース名とパスワードを置き換えてから実行します。

与える参照は次だけです。

| 対象 | 許す列 |
| --- | --- |
| `User` | `id`、`email`、`name` |
| `WebAuthnCredential` | `id`、`userId`（件数だけ） |
| `App`、`AppGrant` | `SELECT` |

`User.password`、`User.role`、パスキーの公開鍵、カウンタ、`credentialId`、`transports` は与えません。

`DATABASE_URL` は、このロールで同じデータベースへ接続します。

```text
DATABASE_URL="postgresql://app_participant:replace-me@db-host:5432/database_name?schema=public"
```

`replace-me` は `CREATE ROLE` で決めたパスワードです。`database_name` は認証サーバーの `DATABASE_URL` と同じデータベース名です。認証サーバー側の接続文字列は、読み書きできるユーザーのままにします。

## Redis

Redis のユーザーは、全参加アプリで `app_participant` の1人です。アプリごとに作りません。認証サーバーの `REDIS_URL` は、読み書きできるユーザーのままです。

認証サーバーに `PARTICIPANT_REDIS_PASSWORD` があるとき、起動後の最初のリクエストでこのユーザーを上書きします。未設定なら作りません。パスワードは PostgreSQL の `app_participant` とは別です。設定したあとは、認証サーバーを再起動してから参加アプリを接続します。

許す操作は次だけです。`KEYS`、`SCAN`、セッションの `SET`、索引への `SADD` はありません。

| キー | 操作 |
| --- | --- |
| `sess:*` | `GET`、`EXPIRE`、`DEL` |
| `handoff:*` | `GET`、`GETDEL`、`DEL` |
| `sess:user:*` | `SREM` |

引き渡しコードの消費は `GETDEL` です。このアプリが操作するのは `sess:{APP_ID}:*` と `handoff:{APP_ID}:*` だけです。

`REDIS_URL` は、このユーザーで同じ Redis へ接続します。

```text
REDIS_URL="redis://app_participant:replace-me@redis-host:6379/"
```

`replace-me` は `PARTICIPANT_REDIS_PASSWORD` と同じ値です。Coolify の Redis ユーザーをこのアプリでも使うと、この制限は掛からず、セッションの `SET` もできます。

`REDIS_KEY_PREFIX` と `SESSION_MAX_AGE_SECONDS` は、認証サーバーと同じ値にします。未設定のプレフィックスは空、未設定のセッション寿命は 2592000 秒です。プレフィックスがあるとき、実際のキーは `{REDIS_KEY_PREFIX}{論理キー}` です。

## 切り替えの確認

`DATABASE_URL` と `REDIS_URL` を参加アプリ用に変えて再起動したあと、`APP_ORIGIN/` が「ログイン中」になり、ログアウトでそのホストの `__Host-session` が消えれば、制限した接続で足りています。画面の確認手順は [verification.md](verification.md) です。
