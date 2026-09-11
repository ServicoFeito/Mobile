import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { getUsuarioAutenticado } from "../_shared/auth.ts";
import { criarCobranca } from "../_shared/efi.ts";

function erro(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  let usuarioId: string;
  try {
    usuarioId = await getUsuarioAutenticado(req);
  } catch (resp) {
    return resp as Response;
  }

  const { pagamento_id } = await req.json();
  if (!pagamento_id) return erro("pagamento_id_ausente", 400);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pagamento, error: errPag } = await service
    .from("pagamentos")
    .select("id, contratacao_id, valor, tipo, status, txid, pix_copia_cola, qr_code_base64, efi_loc_id")
    .eq("id", pagamento_id)
    .single();
  if (errPag || !pagamento) return erro("nao_encontrado", 404);

  const { data: contratacao, error: errContr } = await service
    .from("contratacoes")
    .select("id, cliente_id")
    .eq("id", pagamento.contratacao_id)
    .single();
  if (errContr || !contratacao) return erro("nao_encontrado", 404);

  if (contratacao.cliente_id !== usuarioId) return erro("nao_autorizado", 401);

  if (pagamento.status === "PAGO") return erro("conflito", 409);

  if (pagamento.status === "PROCESSANDO") {
    return new Response(
      JSON.stringify({
        txid: pagamento.txid,
        pixCopiaCola: pagamento.pix_copia_cola,
        qrCodeBase64: pagamento.qr_code_base64,
        status: "PROCESSANDO",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const prefixo = pagamento.tipo === "ENTRADA" ? "SFENT" : "SFFIN";
  const txid = (prefixo + String(pagamento.id).replace(/-/g, "")).slice(0, 35);

  try {
    const cob = await criarCobranca(txid, pagamento.valor, Deno.env.get("PLATFORM_PIX_KEY")!);

    await service
      .from("pagamentos")
      .update({
        txid,
        efi_loc_id: cob.locId,
        pix_copia_cola: cob.pixCopiaCola,
        qr_code_base64: cob.qrCodeBase64,
        status: "PROCESSANDO",
      })
      .eq("id", pagamento_id);

    return new Response(
      JSON.stringify({ txid, pixCopiaCola: cob.pixCopiaCola, qrCodeBase64: cob.qrCodeBase64, status: "PROCESSANDO" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return erro("gateway_indisponivel", 502);
  }
});
