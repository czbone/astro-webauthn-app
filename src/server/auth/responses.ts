export function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

export function handoffFailureResponse(): Response {
  const body = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>引き渡しに失敗しました</title>
  </head>
  <body>
    <p>引き渡しに失敗しました</p>
    <p><a href="/">はじめからやり直す</a></p>
  </body>
</html>`
  return new Response(body, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    }
  })
}

export function redirectNoStore(location: string, status: 302 | 303): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer'
    }
  })
}
