# テスト

この文書では、参加アプリの自動テストについて説明します。画面を表示するサーバーは起動せず、関数を直接呼び出して Redis と PostgreSQL の結果を確認します。手動での画面確認は [verification.md](verification.md)、権限の仕様は [access.md](access.md)、接続の制限は [connections.md](connections.md) を参照してください。

## 分け方

Vitest の project は `unit` と `integration` の2つです。統合テストでは、ファイルを直列に実行し、各ファイルでモジュールを分離します。

| コマンド                | 対象                                               |
| ----------------------- | -------------------------------------------------- |
| `pnpm test`             | `src/**/*.test.ts`。`*.integration.test.ts` は除く |
| `pnpm test:watch`       | ユニットテストを監視して再実行                     |
| `pnpm test:integration` | `src/**/*.integration.test.ts`                     |
| `pnpm test:all`         | ユニットテストのあと統合テスト                     |
| `pnpm db:ensure-test`   | `TEST_DATABASE_URL` のデータベースが無ければ作る   |

## 統合テストの接続

テストランナーはコンテナを起動しません。起動済みの PostgreSQL と Redis へ接続します。

`TEST_DATABASE_URL` は必須です。開発用 `DATABASE_URL` とホスト、ポート、データベース名が一致する場合は、テストを中止します。データベース名には単純な識別子を使います。データベースがまだ作成されていない場合は、`pnpm db:ensure-test` を実行します。この URL には、テーブルとロールを作成できるユーザーを指定します。

`TEST_REDIS_URL` は任意です。未設定の場合は `redis://localhost:6379/` を使います。この URL には、`SET` と `ACL SETUSER` を実行できるユーザーを指定します。

アプリ本体は、専用データベース上のテスト用ロール `app_participant_itest` と、同名の Redis ACL ユーザーで接続します。開発用の `app_participant` は変更しません。列に対する権限は [connections.md](connections.md) と同じです。

| 対象                 | 許す操作                                      |
| -------------------- | --------------------------------------------- |
| `User`               | `id`、`email`、`name`、`role`、`disabledAt` の `SELECT` |
| `WebAuthnCredential` | `id`、`userId` の `SELECT`                    |
| `App`、`AppGrant`    | `SELECT`                                      |
| `sess:*`             | `GET`、`EXPIRE`、`DEL`                        |
| `handoff:*`          | `GET`、`GETDEL`、`DEL`                        |
| `sess:user:*`        | `SREM`、`SMEMBERS`、`DEL`                     |

Redis では、接続時に ioredis が送信する `INFO` だけを追加で許可します。`SET` と `SADD` は許可しません。キーのパターンには `REDIS_KEY_PREFIX` を付けます。この接頭辞は `awa-itest:` に globalSetup のプロセス ID を付加したものです。終了時には ACL ユーザーと、その接頭辞が付いたキーを削除します。PostgreSQL のロールは次回の実行に備えて残します。

専用データベースには、参照する4テーブルだけを用意します。`User` には、アプリが参照する `id`、`email`、`name`、`role`、`disabledAt` と、読み取り拒否の確認に使う `password` を含めます。マイグレーションは実行しません。

各テストの前に、管理接続で4テーブルのデータを削除し、接頭辞が付いた Redis キーだけを `SCAN` と `DEL` で削除します。接頭辞は `awa-itest:` で始まり、空白や括弧を含みません。

dotenv の読み込み後に、テストプロセスの環境変数を次の値で上書きします。アプリコードからは、開発用 `.env` の接続先を参照できません。

| 変数                      | 値                           |
| ------------------------- | ---------------------------- |
| `APP_ID`                  | `app`                        |
| `APP_ORIGIN`              | `http://app.localhost:4000`  |
| `AUTH_ORIGIN`             | `http://auth.localhost:3000` |
| `SESSION_MAX_AGE_SECONDS` | `120`                        |

フィクスチャのセッション TTL は 40 秒です。

## ユニットテスト

サーバーもデータベースも使いません。

| 対象            | 確認                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie          | `Path=/`、`Max-Age`、`SameSite=Lax`、`HttpOnly`、`Secure` だけを付ける。値をエンコードし、正しく復元する                                |
| 戻りパス        | `/grants` とクエリは残す。外部 URL、`/callback`、`/logged-out`、空、バックスラッシュ、NUL は `/` にする                                 |
| Origin          | `APP_ORIGIN` と完全一致するときだけ許可する。末尾の `/` も不一致                                                                        |
| 正規ホスト      | 別ホストの GET は同じパスとクエリへ 302 する。同じホストと変更系はそのまま                                                              |
| セッション JSON | キーが無いときは削除しない。JSON でない値と `userId` が無い値は捨てる。`appId` が違うときは `userId` を残して捨てる。一致すれば続行する |
| 文字列比較      | 同じ文字列だけ一致する。長さが違えば不一致                                                                                              |
| Redis キー      | `{接頭辞}sess:{APP_ID}:{tokenHash}`、`handoff:{APP_ID}:{codeHash}`、`sess:user:{userId}`。索引の要素は `{APP_ID}/{tokenHash}`           |
| 索引要素        | `{appId}/{tokenHash}` は最初の `/` で分割する。スラッシュが無い要素と、スラッシュが先頭または末尾にある要素は解釈しない                |

## 統合テスト

### アクセス解決

`resolveAccess` は、認証を通過したセッションの TTL を延ばしません。TTL を延ばすのは `slideSession` だけです。セッションが壊れている場合、またはユーザー行が存在しない場合は、自分のセッションと索引の `{APP_ID}/{tokenHash}` だけを削除します。`disabledAt` がある場合は、索引に含まれる全セッション、現在のセッション、および索引を削除します。

| 状態 | 結果 |
| --- | --- |
| トークンが無い | 未認証。既存のセッションは残す |
| セッションキーが無い | 未認証。Cookie を消す。索引は残す |
| JSON でない | セッションだけ消す。索引は残す |
| `appId` が別アプリ | 自分のキーと索引要素だけ外す。別アプリのセッションと要素は残す |
| `User` が無い | 自分のセッションと索引要素を消す。別アプリの要素は残す |
| `disabledAt` がある | 未認証。自分と別アプリのセッション、索引を消す |
| パスキーが 0 件 | `no-passkey`。利用者を含む。セッションは残し、TTL は 40 秒のまま |
| 付与が無い、または `allow` 以外 | `no-grant`。TTL は 40 秒のまま |
| 実効許可が `allow` | `ok`。TTL は 40 秒のまま。共通ロールは結果に含める |

`slideSession` は `cookieStore.run` の中で呼びます。TTL を 40 秒より長く、120 秒以下に戻し、`__Host-session` の `Max-Age` を 120 にします。`allow` のときだけ呼びます。

### 引き渡し

`consumeHandoff` は、Cookie の `state` とクエリが一致することを確認してから `GETDEL` を実行します。

| 状態 | 結果 |
| --- | --- |
| コード、`state`、`redirectUri`、セッションの `userId` が一致 | トークンと `/grants` を返す。キーは削除され、2回目の呼び出しは失敗する |
| Cookie の `state` がクエリと異なる | 失敗し、キーは残る |
| レコードの `state` が異なる | 失敗し、コードは再利用できない |
| `redirectUri` が `{APP_ORIGIN}/callback` と異なる | 失敗し、コードは再利用できない |
| セッションの `userId` がレコードと異なる | 失敗し、コードは再利用できない。セッションキーは残る |

### ログアウト

`handleLogout` は `cookieStore.run` の中で呼びます。

| 状態 | 結果 |
| --- | --- |
| `Origin` が `APP_ORIGIN` と違う | 403「オリジンが不正です」。Cookie もセッションも索引も残す |
| 付与が無い | 303 で `/logged-out`。`__Host-session` と `__Host-handoff` の `Max-Age` は 0。自分と別アプリのセッション、索引を削除する。他の利用者のデータは残す。解釈できない索引要素はキーとして扱わない |
| パスキーが 0 件 | 303 で `/logged-out`。自分と別アプリのセッション、索引を消す |
| 索引に自分の要素が無い | 303 で `/logged-out`。自分のセッションを消す |
| `disabledAt` がある | 401「ログインが必要です」。`__Host-session` の `Max-Age` は 0。自分と別アプリのセッション、索引を消す |

### 付与一覧

例外一覧は、共通ロールが `admin` のときだけ読みます。`listGrants` は、この `APP_ID` の付与だけをメールアドレスの昇順で返します。別アプリの付与は含めません。`allow` と `none` の行を含め、既定だけで入っている利用者は含めません。

### 接続権限

| 操作 | 結果 |
| --- | --- |
| 参加アプリの接続で `User.password` を読む | 権限エラー。`id`、`email`、`name`、`role`、`disabledAt` は読める |
| 参加アプリの接続でセッションキーを `SET` する | `NOPERM`。管理接続が入れた値の `GET` はできる |
