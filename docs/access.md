# 権限とアクセス制御

参加アプリは、画面を出す前にセッション、パスキー、`AppGrant` の順で確認します。画面の権限は `AppGrant.permission`（`admin` または `user`）だけです。`User.role` は読みません。認証サーバー上の管理者でも、このアプリの `AppGrant` が無ければ利用者ではありません。

付与の作成と変更は認証サーバーだけが行います。付与を外した効果と、`permission` の変更は、次のリクエストから効きます。セッションの作り直しは要りません。

手動での確認手順は [verification.md](verification.md) です。仕様は [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md) です。

## 解決の順

`__Host-session` の値を SHA-256（hex 小文字）にし、`sess:{APP_ID}:{tokenHash}` を読みます。実際の Redis キーには `REDIS_KEY_PREFIX` が付きます。

```text
Cookie が無い
  → 未認証。Cookie は消さない
セッションが無い、JSON でない、appId が APP_ID と違う、userId が空
  → キーがあるときは削除し、userId があれば索引から外す。Cookie を消して未認証
User が無い（id, email, name だけを引く）
  → セッションと索引を消し、Cookie を消して未認証
WebAuthnCredential が 0 件
  → パスキー未登録。TTL も Cookie も延ばさない
AppGrant が無い、または permission が admin / user 以外
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
| `admin` または `user` | その権限でページを描く |

`/` はメールアドレス、名前、権限を出します。表示は `admin` が「管理者」、`user` が「利用者」です。「付与一覧」のリンクは `admin` だけに出します。

`/grants` は、解決済みの権限が `admin` のときだけ一覧を読みます。列はメールアドレス、名前、権限で、メールアドレスの昇順です。`user` が開くと 403「この画面を利用する権限がありません」で、`/` へのリンクを出します。この拒否は付与を確認したあとに行うので、セッションの TTL は延ばします。

更新は引き渡しへ送りません。未認証の更新は 401「ログインが必要です」です。

## 更新

POST、PUT、PATCH、DELETE は、`Origin` が `APP_ORIGIN` と完全一致するときだけ受けます。`Origin` が無い、または一致しない更新は 403「オリジンが不正です」です。他オリジン向けの `Access-Control-Allow-Credentials` は返しません。

通す更新は `POST /logout` だけです。それ以外は、セッションがあっても 404「見つかりません」です。パスキーが無い更新は 403「先にパスキーを登録してください」、付与が無い更新は 403「このアプリを利用する権限がありません」です。

ログアウトは、付与が無いセッションでも通ります。自分の `sess:{APP_ID}:{tokenHash}` を削除し、索引からその要素を外し、`__Host-session` と `__Host-handoff` を消して `/logged-out` へ 303 します。認証サーバーのセッションと、他アプリのセッションは残します。

## 読むデータ

PostgreSQL は次の列だけを参照します。

| テーブル | 参照 |
| --- | --- |
| `User` | `id`、`email`、`name` |
| `WebAuthnCredential` | 件数（`id` と `userId`） |
| `App`、`AppGrant` | 参照。このアプリが書くことはない |

`User.password`、`User.role`、パスキーの公開鍵、カウンタ、`credentialId`、`transports` は読みません。一覧の SQL は、解決済みの `permission` が `admin` のときだけ実行します。
