import React, { useState } from "react";
import {
  Linking,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import type { AdvertisingData, Campaign, Placement } from "./advertisingTypes";
import { Icon, Button } from "./components";
import { palette, s } from "./styles";
import { ps } from "./partnershipStyles";
import GoogleBanner from "./GoogleBanner";
export function CampaignCard({
  campaign,
  onError,
}: {
  campaign: Campaign;
  onError: (message: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const { width } = useWindowDimensions();
  const horizontal = width >= 750;
  return (
    <View style={[ps.campaign, horizontal && { flexDirection: "row" }]}>
      {campaign.image_url && !imageFailed && (
        <Image
          source={{ uri: campaign.image_url }}
          style={[
            ps.campaignImage,
            horizontal && {
              width: "42%",
              aspectRatio: undefined,
              minHeight: 225,
            },
          ]}
          contentFit="contain"
          accessibilityLabel={`Banner de ${campaign.partner_name}`}
          onError={() => setImageFailed(true)}
        />
      )}
      <View
        style={[
          ps.campaignBody,
          horizontal && { flex: 1, justifyContent: "center" },
        ]}
      >
        <View style={ps.campaignBrand}>
          {campaign.logo_url && (
            <Image
              source={{ uri: campaign.logo_url }}
              style={ps.logoSmall}
              contentFit="contain"
            />
          )}
          <Text style={ps.brandName}>{campaign.partner_name}</Text>
          <Icon name="megaphone-outline" color="#A88194" size={17} />
        </View>
        <Text style={ps.campaignTitle}>{campaign.title}</Text>
        {!!campaign.description && (
          <Text style={ps.description}>{campaign.description}</Text>
        )}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${campaign.cta} — ${campaign.partner_name}`}
          onPress={() =>
            Linking.openURL(campaign.url).catch(() =>
              onError("Não foi possível abrir o site do parceiro."),
            )
          }
          style={({ pressed }) => [ps.campaignCta, pressed && s.pressed]}
        >
          <Text style={ps.ctaText}>{campaign.cta}</Text>
          <Icon
            name="arrow-up-right-box-outline"
            color={palette.rose}
            size={22}
          />
        </Pressable>
      </View>
    </View>
  );
}
export function AdvertisingSlot({
  data,
  placement,
  onError,
}: {
  data: AdvertisingData | null;
  placement: Placement;
  onError: (message: string) => void;
}) {
  const [active, setActive] = useState(0);
  if (!data) return null;
  const campaigns = data.banners.filter((b) =>
    b.placements.includes(placement),
  );
  const index = Math.min(active, Math.max(0, campaigns.length - 1));
  const google = data.settings.google_placements.includes(placement);
  return (
    <>
      {campaigns.slice(index, index + 1).map((c) => (
        <View key={c.id} style={ps.section}>
          <View style={ps.sponsorLabel}>
            <Text style={ps.label}>PUBLICIDADE</Text>
            <Text style={[ps.label, { fontSize: 9, letterSpacing: 0.5 }]}>
              PARCERIA COMERCIAL
            </Text>
          </View>
          <CampaignCard campaign={c} onError={onError} />
          {campaigns.length > 1 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 14,
                marginTop: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Campanha anterior"
                onPress={() =>
                  setActive((index - 1 + campaigns.length) % campaigns.length)
                }
                style={s.close}
              >
                <Icon name="chevron-back" size={18} />
              </Pressable>
              <Text style={ps.label}>
                {index + 1} / {campaigns.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próxima campanha"
                onPress={() => setActive((index + 1) % campaigns.length)}
                style={s.close}
              >
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            </View>
          )}
        </View>
      ))}
      {google && <GoogleBanner settings={data.settings} />}
    </>
  );
}
export function PartnerShortcut({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [ps.partnerLink, pressed && s.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Conhecer parceiros"
    >
      <Icon name="people-outline" color="#547461" size={25} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ fontFamily: "Manrope700", fontSize: 15, color: "#34523F" }}
        >
          Conexões que somam
        </Text>
        <Text
          style={{ fontFamily: "DMSans400", fontSize: 12, color: "#6B7D70" }}
        >
          Conheça nosso espaço de parcerias
        </Text>
      </View>
      <Icon name="arrow-forward" color="#547461" size={19} />
    </Pressable>
  );
}
export function PartnersScreen({
  data,
  onError,
}: {
  data: AdvertisingData | null;
  onError: (message: string) => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 750;
  const gridWidth = width >= 1000 ? Math.min(width - 304, 1100) : width - 40;
  const email = data?.settings.contact_email;
  return (
    <>
      <AdvertisingSlot data={data} placement="PARTNERS" onError={onError} />
      {!!data?.partners.length && (
        <>
          <View style={[ps.homeSection, { marginTop: 29, marginBottom: 0 }]}>
            <Text style={s.sectionTitle}>Conheça os parceiros</Text>
            <Text style={s.resultsCount}>{data.partners.length}</Text>
          </View>
          <View style={ps.partnerGrid}>
            {data.partners.map((p) => (
              <View
                key={p.id}
                style={[
                  ps.partner,
                  { width: wide ? (gridWidth - 16) / 2 : gridWidth },
                ]}
              >
                <View style={ps.partnerLogo}>
                  {p.logo_url ? (
                    <Image
                      source={{ uri: p.logo_url }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="contain"
                      accessibilityLabel={`Logo de ${p.name}`}
                    />
                  ) : (
                    <Text style={ps.initials}>
                      {p.name.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={ps.partnerTitle}>{p.name}</Text>
                {!!p.description && (
                  <Text style={ps.description}>{p.description}</Text>
                )}
                {!!p.website && (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Conhecer ${p.name}`}
                    style={ps.campaignCta}
                    onPress={() =>
                      Linking.openURL(p.website).catch(() =>
                        onError("Não foi possível abrir o site do parceiro."),
                      )
                    }
                  >
                    <Text style={ps.ctaText}>Conhecer parceiro</Text>
                    <Icon
                      name="arrow-up-right-box-outline"
                      color={palette.rose}
                    />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </>
      )}
      <View style={ps.invite}>
        <Icon name="megaphone-outline" color={palette.rose} size={28} />
        <Text style={ps.inviteTitle}>Sua marca pode{"\n"}estar aqui.</Text>
        <Text style={ps.description}>
          Apresente sua empresa em um espaço dedicado a profissionais e
          estudantes de mamografia.
        </Text>
        {email ? (
          <View style={{ alignSelf: "flex-start" }}>
            <Button
              label="Seja parceiro"
              icon="mail-outline"
              onPress={() =>
                Linking.openURL(
                  `mailto:${email}?subject=Parceria%20-%20Dominando%20a%20Mamografia`,
                ).catch(() => onError(`Entre em contato: ${email}`))
              }
            />
          </View>
        ) : (
          <Text style={[ps.description, { fontSize: 12 }]}>
            Novas parcerias serão apresentadas neste espaço.
          </Text>
        )}
      </View>
    </>
  );
}
