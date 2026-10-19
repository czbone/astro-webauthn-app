# 権限とアクセス制御

参加アプリは、画面を出す前にセッション、ユーザーの有効状態、パスキー、実効許可の順で確認します。入場は実効許可が `allow` のときだけです。`User.role` は入場には使いません。入場後の画面分けに読みます。共通 `admin` でも、実効許可が `allow` でなければこのアプリの利用者ではありません。

実効許可は [grant.md](../planning/app-permissions/grant.md) の手順です。`App` が無いとき、`AppGrant.permission` が `allow` 以外のとき、行が無く既定も `allow` でないときは付与なしです。`admin` や `user` という文字列は、行にあっても既定にあっても付与なしです。行があるときは既定へ進みません。

付与の作成と変更は認証サーバーだけが行います。付与を外した効果、`permission` の変更、無効化は、次のリクエストから効きます。セッションの作り直しは要りません。

このアプリに公開パスはありません。未ログインの画面は引き渡しを始め、このアプリの本文は出しません。`/callback` と `/logged-out` からは引き渡しを始めません。

手動での確認手順は [verification.md](verification.md) です。仕様は [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md) と [app-permissions](../planning/app-permissions/README.md) です。

## 解決の順

`__Host-session` の値を SHA-256（hex 小文字）にし、`sess:{APP_ID}:{tokenHash}` を読みます。実際の Redis キーには `REDIS_KEY_PREFIX` が付きます。

```text
Cookie が無い
  → 未認証。Cookie は消さない
セッションが無い、JSON でない、appId が APP_ID と違う、userId が空
  → キーがあるときは削除し、userId があれば索引から外す。Cookie を消して未認証
User が無い、または disabledAt がある（id, email, name, role, disabledAt を引く）
  → セッションと索引を消し、Cookie を消して未認証
WebAuthnCredential が 0 件
  → パスキー未登録。TTL も Cookie も延ばさない
実効許可が allow 以外
  → 付与なし。Cookie は残す。TTL も Cookie の Max-Age も延ばさない
ここまで通ったとき
  → 画面ではセッションの TTL と Cookie の Max-Age を延ばす
```

索引の要素は `{APP_ID}/{tokenHash}` です。参加アプリが索引から外せるのは、自分のアプリ ID の要素だけです。

## 画面

GET と HEAD だけが画面です。`/callback`、`/logged-out`、ファイル名に `.` を含む静的ファイルは、セッションがなくても引き渡しを始めません。

| 解決結果 | 画面 |
| --- | --- |
| 未認証 | `{AUTH_ORIGIN}/auth/handoff` へ 302。ログイン画面は出さない |
| パスキー未登録 | `{AUTH_ORIGIN}/setup-passkey` へ 302 |
| 付与なし | 403「このアプリを利用する権限がありません」。ログアウトだけできる |
| 実効許可が `allow` | 共通ロールでページを描く |

`/` はメールアドレス、名前、共通ロールを出します。表示は `admin` が「管理者」、`manager` が「ユーザー管理者」、`user` が「一般ユーザー」です。利用許可の表示は「利用可」です。

「利用許可の例外」のリンクは共通 `admin` だけに出します。「アプリ内ロール」のリンクは共通 `admin` または `manager` に出します。

`/grants` は、共通ロールが `admin` のときだけ一覧を読みます。列はメールアドレス、名前、利用許可で、メールアドレスの昇順です。`allow` は「利用可」、`none` は「利用不可」です。一覧の先頭に既定を出します。既定が `allow` のときは「全利用者に利用を許可」、`NULL` のときは「利用を許可しない（個別のみ）」です。それ以外の既定は「設定エラー。既定からは入場させない」です。既定だけで入っている利用者は出しません。行が無いときは「例外の付与はありません」。変更操作は置きません。それ以外の共通ロールは 403「この画面を利用する権限がありません」で、`/` へのリンクを出します。この拒否は入場を確認したあとに行うので、セッションの TTL は延ばします。

`/roles` は、共通ロールが `admin` または `manager` のときだけ開きます。このアプリは業務操作を持たないので、割り当て可能なアプリ内ロールはありません。画面は「割り当てられるアプリ内ロールはありません」と出します。更新口は置きません。共通 `user` は 403「この画面を利用する権限がありません」で、`/` へのリンクを出します。この拒否でも TTL は延ばします。ロールを足すときは `public` 以外のスキーマに `User.id` をキーにして置き、そのスキーマだけこのアプリがマイグレーションします。`AppGrant` には書きません。定義が無いあいだ、更新は `POST /logout` だけです。

更新は引き渡しへ送りません。未認証の更新は 401「ログインが必要です」です。

## 更新

POST、PUT、PATCH、DELETE は、`Origin` が `APP_ORIGIN` と完全一致するときだけ受けます。`Origin` が無い、または一致しない更新は 403「オリジンが不正です」です。他オリジン向けの `Access-Control-Allow-Credentials` は返しません。

通す更新は `POST /logout` だけです。それ以外は、セッションがあっても 404「見つかりません」です。パスキーが無い更新は 403「先にパスキーを登録してください」、付与が無い更新は 403「このアプリを利用する権限がありません」です。

ログアウトは、付与が無いセッションでも通ります。自分の `sess:{APP_ID}:{tokenHash}` を削除し、索引からその要素を外し、`__Host-session` と `__Host-handoff` を消して `/logged-out` へ 303 します。認証サーバーのセッションと、他アプリのセッションは残します。

## 読むデータ

PostgreSQL は次の列だけを参照します。

| テーブル | 参照 |
| --- | --- |
| `User` | `id`、`email`、`name`、`role`、`disabledAt` |
| `WebAuthnCredential` | 件数（`id` と `userId`） |
| `App`、`AppGrant` | 参照。このアプリが書くことはない |

`User.password`、パスキーの公開鍵、カウンタ、`credentialId`、`transports` は読みません。例外一覧の SQL は、共通ロールが `admin` のときだけ実行します。
