import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUsuarioAutenticado(req: Request): Promise<string> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) {
    throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  }
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supa.auth.getUser(jwt);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  }
  return data.user.id;
}
