import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Text, View } from "react-native";
import { api, User } from "./api";
import { Button } from "./components";
import { s } from "./styles";

interface Offer {
  enabled: boolean;
  amount_cents: number | null;
  purchase_type: "ONE_TIME";
  test_mode: boolean;
}
interface Payment {
  id: number;
  status: string;
  checkout_url: string | null;
}
export default function AsaasPayment({ user, onUser, onPaid }: {
  user: User;
  onUser: (user: User) => void;
  onPaid: () => void;
}) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    api<Offer>("/billing/offer", { signal: abort.signal })
      .then(setOffer)
      .catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [retry]);

  const checkPayment = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User; payment: Payment | null }>("/billing/status");
      setPayment(result.payment);
      onUser(result.user);
      if ((result.user.premium_permanent ?? !!result.user.is_premium) || result.user.role === "ADMIN") onPaid();
      else setError(result.payment?.status === "REFUNDED" || result.payment?.status === "CHARGEBACK"
        ? "O pagamento foi estornado ou contestado. Entre em contato com o suporte."
        : "Ainda aguardamos a confirmação do pagamento. Tente verificar novamente em instantes.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [onUser, onPaid]);
  useEffect(() => {
    if (!payment) return;
    const sync = () => { void checkPayment(); };
    if (Platform.OS === "web") {
      const onVisible = () => { if (document.visibilityState === "visible") sync(); };
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") sync(); });
    return () => subscription.remove();
  }, [payment, checkPayment]);

  async function checkout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Payment>("/billing/checkout", { method: "POST" });
      setPayment(result);
      if (result.checkout_url) {
        const url = new URL(result.checkout_url);
        if (url.protocol !== "https:" || !["asaas.com", "www.asaas.com", "sandbox.asaas.com"].includes(url.hostname))
          throw new Error("Link de pagamento inválido. Entre em contato com o suporte.");
        await Linking.openURL(result.checkout_url);
      } else await checkPayment();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if ((user.premium_permanent ?? (!!user.is_premium && !user.trial_active)) || user.role === "ADMIN") return <Text style={s.subtle}>Seu Premium está ativo.</Text>;
  return <View style={{ gap: 14, width: "100%" }}>
    {offer?.enabled ? <>
      <Text style={s.profileTitle}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((offer.amount_cents || 0) / 100)}</Text>
      <Text style={s.subtle}>Pagamento único por Pix ou cartão. O Premium fica disponível após a confirmação.</Text>
      {offer.test_mode && <Text style={s.error}>Ambiente de teste: este pagamento não é uma compra real.</Text>}
      <Button label={busy ? "Aguarde..." : payment?.checkout_url ? "Continuar pagamento" : "Comprar Premium"} disabled={busy} onPress={checkout} />
      <Button label="Já paguei, verificar" secondary disabled={busy} onPress={checkPayment} />
    </> : <>
      <Button label={offer ? "Premium em breve" : "Consultando preço..."} disabled onPress={() => {}} />
      <Text style={s.subtle}>{offer ? "Compra do Premium em preparação. Em breve você poderá pagar por aqui." : "Carregando formas de pagamento..."}</Text>
      {error && <Button label="Tentar novamente" secondary onPress={() => { setError(""); setRetry((n) => n + 1); }} />}
    </>}
    {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
