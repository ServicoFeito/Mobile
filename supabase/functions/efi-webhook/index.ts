import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const tokenEsperado = Deno.env.get("EFI_WEBHOOK_TOKEN");
  const segmentos = url.pathname.split("/").filter(Boolean);
  if (!tokenEsperado || !segmentos.includes(tokenEsperado)) {
    return new Response("not found", { status: 404 });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { pix?: Array<{ txid: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const itens: Array<{ txid: string }> = body.pix ?? [];

  let algumFalhou = false;

  for (const item of itens) {
    const { data: pagamento } = await service
      .from("pagamentos")
      .select("id, contratacao_id, status, txid")
      .eq("txid", item.txid)
      .maybeSingle();
    if (!pagamento || pagamento.status === "PAGO") continue;

    // Registra o pagamento como PAGO incondicionalmente -- a EFI ja recebeu o
    // dinheiro, isso precisa ficar registrado mesmo que o contrato tenha sido
    // cancelado nesse meio-tempo (reconciliacao/estorno manual fica pro time
    // de operacao, fora do escopo deste endpoint).
    const { error: errPagUpdate } = await service
      .from("pagamentos")
      .update({ status: "PAGO", data_pagamento: new Date().toISOString() })
      .eq("id", pagamento.id);
    if (errPagUpdate) {
      algumFalhou = true;
      continue;
    }

    const { data: contratacao } = await service
      .from("contratacoes")
      .select("id, cliente_id, prestador_id, proposta_id, status")
      .eq("id", pagamento.contratacao_id)
      .single();
    if (!contratacao) {
      algumFalhou = true;
      continue;
    }

    // Guard: só avanca o STATUS do contrato se ele ainda estiver no estado
    // esperado pra essa transicao. Um contrato ja CANCELADA (cancelado depois
    // do QR ter sido gerado, mas antes do Pix cair) fica CANCELADA -- o
    // pagamento fica registrado acima, mas o contrato nao "ressuscita".
    if (pagamento.txid.startsWith("SFENT")) {
      await service
        .from("contratacoes")
        .update({ entrada_paga: true, status: "AGENDADA" })
        .eq("id", contratacao.id)
        .eq("status", "AGUARDANDO_PAGAMENTO");
    } else if (pagamento.txid.startsWith("SFFIN")) {
      await service
        .from("contratacoes")
        .update({ final_pago: true, status: "CONCLUIDA" })
        .eq("id", contratacao.id)
        .eq("status", "EM_ANDAMENTO");
    }

    const { data: proposta } = await service
      .from("propostas")
      .select("conversa_id")
      .eq("id", contratacao.proposta_id)
      .single();

    if (proposta) {
      await service.from("mensagens").insert({
        conversa_id: proposta.conversa_id,
        remetente_id: contratacao.cliente_id,
        tipo: "PAGAMENTO_CONFIRMADO",
        corpo: "Pagamento confirmado.",
      });
    }

    await service.from("notificacoes").insert([
      {
        usuario_id: contratacao.cliente_id,
        titulo: "Pagamento confirmado",
        mensagem: "Seu pagamento foi confirmado.",
        tipo: "PAGAMENTO",
        referencia_id: contratacao.id,
      },
      {
        usuario_id: contratacao.prestador_id,
        titulo: "Pagamento confirmado",
        mensagem: "O pagamento foi confirmado.",
        tipo: "PAGAMENTO",
        referencia_id: contratacao.id,
      },
    ]);
  }

  return new Response(algumFalhou ? "erro parcial" : "ok", { status: algumFalhou ? 500 : 200 });
});
