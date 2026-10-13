// Web/iOS não carregam o módulo nativo de compras Android.
import React, { ReactNode } from "react";
import { Text } from "react-native";
import { User } from "./api";
import { s } from "./styles";

export interface PlayBillingProps {
  user: User | null;
  onUser: (user: User) => void;
  onPaid: () => void;
  children: ReactNode;
}
export function PlayBillingProvider({ children }: PlayBillingProps) { return <>{children}</>; }
export function GooglePlayPayment() {
  return <Text style={s.subtle}>Compra pela loja ainda indisponível neste dispositivo.</Text>;
}
