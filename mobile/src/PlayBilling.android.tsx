import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { ErrorCode, fetchProducts, getAvailablePurchases, requestPurchase, useIAP } from "expo-iap";
import type { Product, ProductAndroid, Purchase } from "expo-iap";
import { api, User } from "./api";
import { Button } from "./components";
import { s } from "./styles";
import type { PlayBillingProps } from "./PlayBilling";

interface Offer { enabled: boolean; product_id: string; account_id: string | null }
interface Verification { user: User; payment: { status: string; acknowledged: boolean; is_test: boolean } }
interface BillingState {
  enabled: boolean; connected: boolean; loading: boolean; busy: boolean;
  price: string; error: string; message: string;
  buy: () => Promise<void>; restore: () => Promise<void>; retry: () => Promise<void>;
}
const BillingContext = createContext<BillingState | null>(null);
function buyOption(product: ProductAndroid) {
  return product.discountOffers?.filter((option) => !option.rentalDetailsAndroid && !option.preorderDetailsAndroid)
    .sort((a, b) => a.price - b.price)[0];
}

export function PlayBillingProvider(props: PlayBillingProps) {
  return props.user ? <AccountBilling key={props.user.id} {...props} user={props.user} /> : <>{props.children}</>;
}
function AccountBilling({ user, onUser, onPaid, children }: PlayBillingProps & { user: User }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const alive = useRef(false);
  const callbacks = useRef({ user, onUser, onPaid });
  const verifyRef = useRef<(purchase: Purchase) => Promise<Verification | null>>(async () => null);
  const restoreRef = useRef<(explicit?: boolean) => Promise<void>>(async () => {});
  const processing = useRef(new Map<string, Promise<Verification | null>>());
  const purchasing = useRef(false);
  useEffect(() => { callbacks.current = { user, onUser, onPaid }; }, [user, onUser, onPaid]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const { connected, reconnect } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void verifyRef.current(purchase).catch((e: Error) => {
        if (alive.current) setError(e.message);
      }).finally(() => {
        purchasing.current = false;
        if (alive.current) setBusy(false);
      });
    },
    onPurchaseError: (e) => {
      purchasing.current = false;
      if (!alive.current) return;
      setBusy(false);
      if (e.code === ErrorCode.UserCancelled) { setMessage("Compra cancelada. Você pode continuar estudando os conteúdos gratuitos."); return; }
      if (e.code === ErrorCode.AlreadyOwned) { void restoreRef.current(true); return; }
      setError("Não foi possível concluir a compra pela Google Play. Tente novamente.");
    },
    onError: () => {
      if (alive.current) {
        setLoading(false);
        setError("Não foi possível conectar à Google Play. Verifique sua conexão e tente novamente.");
      }
    },
  });

  const loadOffer = useCallback(async () => {
    try {
      const value = await api<Offer>("/billing/google-play/offer");
      if (alive.current) { setOffer(value); if (!value.enabled) setLoading(false); }
    } catch (e) { if (alive.current) { setError((e as Error).message); setLoading(false); } }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void loadOffer(); }, 0);
    return () => clearTimeout(timer);
  }, [loadOffer]);

  const verify = useCallback(async (purchase: Purchase): Promise<Verification | null> => {
    if (!offer?.enabled || purchase.productId !== offer.product_id) return null;
    if (!purchase.purchaseToken) throw new Error("Comprovante indisponível. Use Restaurar compra para tentar novamente.");
    const token = purchase.purchaseToken;
    const existing = processing.current.get(token);
    if (existing) return existing;
    const task = (async () => {
      const result = await api<Verification>("/billing/google-play/verify", {
        method: "POST", body: { purchase_token: token },
      });
      if (!alive.current) return result;
      const previous = callbacks.current.user;
      if (result.user.id !== previous.id) return null;
      const wasPermanent = previous.premium_permanent ?? !!previous.is_premium;
      const nowPermanent = result.user.premium_permanent ?? !!result.user.is_premium;
      if (result.user.is_premium !== previous.is_premium || nowPermanent !== wasPermanent
        || result.user.trial_active !== previous.trial_active) callbacks.current.onUser(result.user);
      if (result.payment.status === "PAID" && result.payment.acknowledged && nowPermanent) {
        setMessage("Seu Premium está ativo.");
        // O servidor já confirmou a compra (acknowledge). Não consumimos o produto.
        if (!wasPermanent && nowPermanent) callbacks.current.onPaid();
      } else if (result.payment.status === "PENDING") {
        setMessage("Pagamento pendente na Google Play. O Premium será liberado após a confirmação.");
      } else setMessage(result.user.trial_active
        ? "A compra foi cancelada ou estornada. Seu período de teste continua até a data informada no perfil."
        : "A compra foi cancelada ou estornada. O Premium desta compra está desativado.");
      return result;
    })();
    processing.current.set(token, task);
    try { return await task; } finally { processing.current.delete(token); }
  }, [offer]);
  useEffect(() => { verifyRef.current = verify; }, [verify]);

  const restore = useCallback(async (explicit = true) => {
    if (!connected || !offer?.enabled) return;
    if (alive.current && explicit) { setBusy(true); setError(""); setMessage(""); }
    try {
      const purchases = await getAvailablePurchases();
      let found = false;
      for (const purchase of purchases) {
        if (purchase.productId !== offer.product_id) continue;
        if ("obfuscatedAccountIdAndroid" in purchase && purchase.obfuscatedAccountIdAndroid
          && purchase.obfuscatedAccountIdAndroid !== offer.account_id) {
          if (explicit) throw new Error("Esta compra pertence a outra conta do app. Entre na conta usada na compra.");
          continue;
        }
        found = true;
        await verify(purchase);
      }
      if (!found && explicit && alive.current) setMessage("Nenhuma compra deste Premium foi encontrada nesta conta da Google Play.");
    } catch (e) { if (alive.current && explicit) setError((e as Error).message); }
    finally { if (alive.current && explicit) setBusy(false); }
  }, [connected, offer, verify]);
  useEffect(() => { restoreRef.current = restore; }, [restore]);

  const loadProduct = useCallback(async () => {
    if (!connected || !offer?.enabled) return;
    try {
      const products = await fetchProducts({ skus: [offer.product_id], type: "in-app" });
      const found = products?.find((item) => item.id === offer.product_id && item.type === "in-app") || null;
      if (alive.current) {
        setProduct(found?.type === "in-app" ? found : null);
        if (!found) setError("Premium ainda indisponível na Google Play para esta conta. Tente novamente mais tarde.");
      }
    } catch { if (alive.current) setError("Não foi possível consultar o preço na Google Play. Tente novamente."); }
    finally { if (alive.current) setLoading(false); }
  }, [connected, offer]);
  useEffect(() => {
    if (!connected || !offer?.enabled) return;
    const timer = setTimeout(() => { void loadProduct(); void restore(false); }, 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { void restore(false); void loadProduct(); }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [connected, offer, loadProduct, restore]);

  async function buy() {
    if (purchasing.current || !connected || !offer?.enabled || !offer.account_id || !product) return;
    purchasing.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      // Atualize os detalhes antes da compra; o preço final aparece no diálogo oficial da Play.
      const products = await fetchProducts({ skus: [offer.product_id], type: "in-app" });
      const current = products?.find((item) => item.id === offer.product_id && item.type === "in-app");
      if (!current || current.platform !== "android" || current.type !== "in-app") throw new Error("Premium indisponível na Google Play.");
      if (alive.current) setProduct(current);
      await requestPurchase({ type: "in-app", request: { google: {
        skus: [offer.product_id], obfuscatedAccountId: offer.account_id,
        offerToken: buyOption(current)?.offerTokenAndroid,
      } } });
      // Resultado chega no listener. Resolver esta Promise não confirma pagamento.
    } catch (e) {
      purchasing.current = false;
      if (alive.current) {
        setBusy(false);
        const code = (e as { code?: string }).code;
        if (code === ErrorCode.UserCancelled) setMessage("Compra cancelada.");
        else if (code === ErrorCode.AlreadyOwned) await restore(true);
        else setError("Não foi possível abrir a compra pela Google Play. Tente novamente.");
      }
    }
  }
  async function retry() {
    setError(""); setLoading(true);
    await loadOffer();
    if (!connected) await reconnect();
    else await loadProduct();
    if (alive.current) setLoading(false);
  }
  return <BillingContext.Provider value={{
    enabled: !!offer?.enabled, connected, loading, busy,
    price: product?.platform === "android" ? buyOption(product)?.displayPrice || product.displayPrice : "", error, message,
    buy, restore: () => restore(true), retry,
  }}>{children}</BillingContext.Provider>;
}

export function GooglePlayPayment() {
  const billing = useContext(BillingContext);
  if (!billing) return <Text style={s.subtle}>Entre na sua conta para comprar o Premium.</Text>;
  return <View style={{ gap: 14, width: "100%" }}>
    {!!billing.price && <Text style={s.profileTitle}>{billing.price}</Text>}
    <Text style={s.subtle}>Compra única pela Google Play. Sem mensalidade ou renovação automática.</Text>
    <Button label={billing.busy ? "Aguarde..." : billing.loading ? "Consultando preço..."
      : !billing.enabled ? "Premium em breve" : "Comprar pela Google Play"}
      disabled={billing.busy || billing.loading || !billing.enabled || !billing.connected || !billing.price}
      onPress={() => { void billing.buy(); }} />
    {!billing.loading && !billing.enabled && <Text style={s.subtle}>Compra pela Google Play em preparação. Você poderá comprar por este botão assim que estiver disponível.</Text>}
    {!billing.loading && billing.enabled && !billing.connected && <Text style={s.subtle}>Abra o app em um dispositivo com Google Play para comprar.</Text>}
    {billing.enabled && billing.connected && <Button label="Restaurar compra" secondary disabled={billing.busy}
      onPress={() => { void billing.restore(); }} />}
    {(!billing.connected || !!billing.error) && <Button label="Tentar novamente" secondary disabled={billing.busy}
      onPress={() => { void billing.retry(); }} />}
    {!!billing.message && <Text accessibilityRole="alert" style={s.subtle}>{billing.message}</Text>}
    {!!billing.error && <Text accessibilityRole="alert" style={s.error}>{billing.error}</Text>}
  </View>;
}
