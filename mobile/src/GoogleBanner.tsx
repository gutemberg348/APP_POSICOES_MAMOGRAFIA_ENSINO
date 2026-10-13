import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Constants from "expo-constants";
import type { AdSettings } from "./advertisingTypes";
import { s, pink } from "./styles";
type AdsModule = typeof import("react-native-google-mobile-ads");
let startup: Promise<AdsModule | null> | undefined;
async function initializeAds(): Promise<AdsModule | null> {
  if (!startup)
    startup = (async () => {
      // Expo Go does not contain this native module; only load it in a custom build.
      if (
        Constants.executionEnvironment === "storeClient" ||
        Platform.OS !== "android"
      )
        return null;
      try {
        const sdk: AdsModule = await import("react-native-google-mobile-ads");
        try {
          await sdk.AdsConsent.gatherConsent();
        } catch {
          /* Prior consent may still allow a request. */
        }
        if (!(await sdk.AdsConsent.getConsentInfo()).canRequestAds) return null;
        await sdk.default().initialize();
        return sdk;
      } catch {
        return null;
      }
    })();
  return startup;
}
export default function GoogleBanner({ settings }: { settings: AdSettings }) {
  const [sdk, setSdk] = useState<AdsModule | null>(null);
  const [failed, setFailed] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [version, setVersion] = useState(0);
  const [privacyError, setPrivacyError] = useState("");
  const { width } = useWindowDimensions();
  const enabled =
    settings.google_enabled &&
    (settings.test_mode ||
      Boolean(Constants.expoConfig?.extra?.admobProductionConfigured));
  useEffect(() => {
    let active = true;
    if (enabled)
      initializeAds()
        .then(async (result) => {
          if (!active || !result) return;
          setSdk(result);
          const consent = await result.AdsConsent.getConsentInfo();
          if (active)
            setPrivacy(consent.privacyOptionsRequirementStatus === "REQUIRED");
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
    };
  }, [enabled]);
  if (!enabled || !sdk) return null;
  const Banner = sdk.BannerAd;
  return (
    <View
      style={{
        marginVertical: 24,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: "#E9E1E4",
        alignItems: "center",
        gap: 12,
      }}
    >
      {!failed && (
        <>
          <Text
            style={{
              fontFamily: "DMSans500",
              fontSize: 10,
              letterSpacing: 1.5,
              color: "#847781",
            }}
          >
            PUBLICIDADE{settings.test_mode ? " · TESTE" : ""}
          </Text>
          <Banner
            key={version}
            unitId={
              settings.test_mode ? sdk.TestIds.BANNER : settings.admob_banner_id
            }
            size={sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            width={Math.min(width - 40, 1100)}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={() => setFailed(true)}
          />
        </>
      )}
      {privacy && (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            try {
              const consent = await sdk.AdsConsent.showPrivacyOptionsForm();
              setPrivacyError("");
              setVersion((v) => v + 1);
              setFailed(!consent.canRequestAds);
            } catch {
              setPrivacyError(
                "Não foi possível abrir suas opções. Tente novamente.",
              );
            }
          }}
          style={{ padding: 10 }}
        >
          <Text style={[s.textLink, { fontSize: 11, color: pink }]}>
            Opções de privacidade dos anúncios
          </Text>
        </Pressable>
      )}
      {!!privacyError && <Text style={s.subtle}>{privacyError}</Text>}
    </View>
  );
}
