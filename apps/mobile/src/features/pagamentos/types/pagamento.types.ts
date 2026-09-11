export interface Pagamento {
  id: string;
  contratacaoId: string;
  valor: number;
  tipo: "ENTRADA" | "FINAL";
  status: "PENDENTE" | "PROCESSANDO" | "PAGO" | "CANCELADO" | "EXPIRADO";
  txid: string | null;
  efiLocId: number | null;
  pixCopiaCola: string | null;
  qrCodeBase64: string | null;
  dataPagamento: string | null;
  createdAt: string;
}
