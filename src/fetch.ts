import { Hono } from 'hono'
import { App } from 'astro/app'
import { actions, middleware, pages } from 'astro/hono'
import { redirectToCanonicalHost } from '@/server/auth/canonical-host'
import { cookieStore } from '@/server/auth/cookie-store'
import { handleLogout } from '@/server/auth/logout'
import { participantEnv, validateRuntimeEnv } from '@/server/env'

validateRuntimeEnv()

const app = new Hono()

app.use(middleware())
app.post('/logout', (c) => handleLogout(c.req.raw))
app.use(actions())
app.use(pages())

/**
 * カスタム fetch パイプラインでは Node アダプタが Set-Cookie を自動付与しない。
 * 参加アプリの Cookie は cookieStore に積み、ここで Set-Cookie にする。
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (!participantEnv.isProduction()) {
      const redirect = redirectToCanonicalHost(request, participantEnv.appOrigin())
      if (redirect) return redirect
    }
    return cookieStore.run(async () => {
      const response = await app.fetch(request)
      const headers = new Headers(response.headers)
      for (const line of cookieStore.current()) {
        headers.append('Set-Cookie', line)
      }
      for (const setCookie of App.getSetCookieFromResponse(response)) {
        headers.append('Set-Cookie', setCookie)
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    })
  }
}
