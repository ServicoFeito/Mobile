import forge from "npm:node-forge@1";

interface CertPem { certChain: string; privateKey: string; }

let certCache: CertPem | null = null;

function extrairCertPem(base64P12: string): CertPem {
  if (certCache) return certCache;
  const der = forge.util.decode64(base64P12);
  const asn1 = forge.asn1.fromDer(der);
  // Sem senha propria no .p12 do repo Kotlin (confirmar no primeiro deploy real;
  // se houver senha, vira o secret EFI_CERT_P12_SENHA e entra no 3o argumento abaixo).
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, "");

  let certPem = "";
  let keyPem = "";
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certPem = forge.pki.certificateToPem(safeBag.cert);
      }
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        keyPem = forge.pki.privateKeyToPem(safeBag.key);
      }
    }
  }
  if (!certPem || !keyPem) throw new Error("efi_cert_p12_invalido");

  certCache = { certChain: certPem, privateKey: keyPem };
  return certCache;
}

function clienteMtls(): Deno.HttpClient {
  const cert = extrairCertPem(Deno.env.get("EFI_CERT_P12_BASE64")!);
  return Deno.createHttpClient({ cert: cert.certChain, key: cert.privateKey });
}

let tokenCache: { token: string; expiraEm: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.token;

  const basic = btoa(`${Deno.env.get("EFI_CLIENT_ID")}:${Deno.env.get("EFI_CLIENT_SECRET")}`);
  const resp = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    client: clienteMtls(),
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) throw new Error(`efi_oauth_falhou:${resp.status}`);
  const data = await resp.json();
  tokenCache = { token: data.access_token, expiraEm: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

export async function criarCobranca(txid: string, valor: number, chavePix: string) {
  const token = await getAccessToken();
  const client = clienteMtls();

  const cobResp = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
    method: "PUT",
    client,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      valor: { original: valor.toFixed(2) },
      chave: chavePix,
    }),
  });
  if (!cobResp.ok) throw new Error(`efi_cob_falhou:${cobResp.status}`);
  const cob = await cobResp.json();

  const qrResp = await fetch(`https://pix.api.efipay.com.br/v2/loc/${cob.loc.id}/qrcode`, {
    client,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!qrResp.ok) throw new Error(`efi_qrcode_falhou:${qrResp.status}`);
  const qr = await qrResp.json();

  return {
    locId: cob.loc.id as number,
    pixCopiaCola: qr.qrcode as string,
    qrCodeBase64: qr.imagemQrcode as string,
  };
}
