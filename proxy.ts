import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const KORUMALI_ROTALAR = ["/dashboard", "/yonetim"];

export async function proxy(request: NextRequest) {
  const korumaliMi = KORUMALI_ROTALAR.some((yol) =>
    request.nextUrl.pathname.startsWith(yol),
  );

  // Supabase oturum çerezi (sb-<ref>-auth-token[.N]) yoksa yenilenecek oturum da
  // yoktur: Auth sunucusuna ağ çağrısı yapmadan geç (landing, login vb. hızlanır).
  const oturumCereziVar = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));

  if (!oturumCereziVar) {
    if (!korumaliMi) return NextResponse.next({ request });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "core" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // createServerClient ile getClaims() arasına başka mantık eklenmemeli;
  // aksi halde oturum yenilemesi bozulup kullanıcılar rastgele çıkışa uğrayabilir.
  // getClaims() asimetrik imza anahtarlarında JWT'yi yerelde doğrular (Auth'a
  // ağ çağrısı yok); simetrik anahtarda getUser()'a düşer. İnce yetki kontrolü
  // sayfalarda (lib/yetki.ts) getUser() ile yapılır.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && korumaliMi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // /api/* çerez oturumu kullanmaz (API anahtarı + imza, webhook imzası, internal sır);
  // proxy'den geçirmek her isteğe gereksiz bir Auth çağrısı ekliyordu.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
