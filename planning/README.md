# 権限の仕様

アプリの利用権限は、アプリの既定と、利用者ごとの例外で決めます。利用者全員の行は作りません。

引き渡し、Cookie、Redis、パスキーは、認証サーバーの [multi-app-auth.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/multi-app-auth.md) と [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md) に従います。本ディレクトリは、その中の権限の決め方を置き換えます。

| 文書 | 内容 |
| --- | --- |
| [grant.md](grant.md) | 認証サーバーと参加アプリが同じ手順で使う仕様 |
| [auth-server.md](auth-server.md) | 認証サーバーが書くデータと、引き渡しの条件 |
| [participant-app.md](participant-app.md) | 参加アプリの解決、画面、参照する SQL |

今の実装は、利用者ごとの `AppGrant` が `admin` または `user` のときだけ通します。本ディレクトリは、これからの仕様です。
