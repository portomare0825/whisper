import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set(name, value)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.delete(name)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Si el usuario no está autenticado
  if (!user) {
    // 1. Rutas de API internas: Retornar error JSON 401 Unauthorized
    // EXCEPCIÓN: El webhook de Stripe se llama desde un servidor externo sin sesión
    if (pathname.startsWith('/api/webhook')) {
      return NextResponse.next()
    }
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicia sesión.' },
        { status: 401 }
      )
    }

    // 2. Rutas del Dashboard: Redirigir al Login conservando la ruta original solicitada
    if (pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
