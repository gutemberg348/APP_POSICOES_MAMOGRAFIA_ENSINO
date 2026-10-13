import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { api, User } from "./api";
import { Button } from "./components";
import { s } from "./styles";

export default function PremiumTrial({ user, onUser, onStarted }: {
  user: User;
  onUser: (user: User) => void;
  onStarted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const activated = await api<User>("/premium/trial/start", { method: "POST" });
      if (!alive.current || activated.id !== user.id) return;
      onUser(activated);
      onStarted();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!user.trial_available || !user.trial_days) return null;
  return <View style={{ gap: 12, width: "100%" }}>
    <Text style={s.subtle}>Experimente o Premium grátis por {user.trial_days} {user.trial_days === 1 ? "dia" : "dias"}.
      {"\n"}O prazo começa ao tocar em Iniciar teste. Não há cobrança automática.</Text>
    <Button label={busy ? "Iniciando teste..." : "Iniciar teste"} disabled={busy}
      onPress={() => { void start(); }} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
