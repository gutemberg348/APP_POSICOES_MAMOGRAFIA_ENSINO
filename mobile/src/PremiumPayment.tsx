import React from "react";
import { Platform, View } from "react-native";
import AsaasPayment from "./AsaasPayment";
import { GooglePlayPayment } from "./PlayBilling";
import { User } from "./api";
import PremiumTrial from "./PremiumTrial";

export default function PremiumPayment(props: {
  user: User;
  onUser: (user: User) => void;
  onPaid: () => void;
  onTrialStarted: () => void;
}) {
  return <View style={{ gap: 20, width: "100%" }}>
    <PremiumTrial key={props.user.id} user={props.user} onUser={props.onUser} onStarted={props.onTrialStarted} />
    {Platform.OS === "web" ? <AsaasPayment {...props} /> : <GooglePlayPayment />}
  </View>;
}
