# 仕様

引き渡し、Cookie、Redis、パスキーは、認証サーバーの [multi-app-auth.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/multi-app-auth.md) と [participant-app.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/participant-app.md) に従います。利用許可は [app-permissions](app-permissions/README.md) です。ここにある権限仕様は認証サーバーの同名文書の写しであり、権限の決め方を上書きしません。

共通ロールは認証サーバーの [auth-app-role-authorization-spec.md](https://github.com/czbone/astro-user-webauthn2/blob/main/planning/auth-app-role-authorization-spec.md) です。このアプリに公開パスはありません。

このアプリの画面と確認手順は [README.md](../README.md) と [docs/access.md](../docs/access.md) です。

| 文書 | 内容 |
| --- | --- |
| [app-permissions/grant.md](app-permissions/grant.md) | 認証サーバーと参加アプリが同じ手順で使う利用許可 |
| [app-permissions/auth-server.md](app-permissions/auth-server.md) | 認証サーバーの権限管理、管理画面/API、引き渡し条件 |
| [app-permissions/participant-app.md](app-permissions/participant-app.md) | 参加アプリの入場、画面、参照する SQL |
