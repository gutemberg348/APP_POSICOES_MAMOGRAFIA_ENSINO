import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { Media } from "./api";
import { pink, s } from "./styles";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 20,
  color = "#706570",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden
    />
  );
}
export function Button({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  light = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  secondary?: boolean;
  disabled?: boolean;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        light && s.heroButton,
        disabled && { opacity: 0.5 },
        pressed && s.pressed,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={19}
          color={secondary || light ? pink : "#fff"}
        />
      )}
      <Text
        style={[
          s.buttonText,
          secondary && { color: pink },
          light && s.heroButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Badge({ premium = false }: { premium?: boolean }) {
  return (
    <View style={[s.badge, premium && s.premiumBadge]}>
      <Icon
        name={premium ? "lock-closed-outline" : "checkmark-circle-outline"}
        size={11}
        color={premium ? "#866233" : "#326D50"}
      />
      <Text style={[s.badgeText, premium && { color: "#866233" }]}>
        {premium ? "Premium" : "Gratuito"}
      </Text>
    </View>
  );
}
export function duration(value: number | null) {
  return value
    ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
    : "Vídeo";
}
export function VideoPlayer({ media }: { media: Media }) {
  const player = useVideoPlayer(media.url!, (p) => {
    p.loop = false;
  });
  const event = useEvent(player, "statusChange", { status: player.status });
  return (
    <View>
      <VideoView
        style={s.video}
        player={player}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true }}
        playsInline
      />
      {event.status === "loading" && (
        <ActivityIndicator color={pink} style={{ padding: 12 }} />
      )}
      {event.status === "error" && (
        <Text style={s.error}>
          Não foi possível reproduzir. Feche e abra o vídeo para renovar o
          acesso.
        </Text>
      )}
    </View>
  );
}
function ImageTile({
  item,
  width,
  saved,
  onOpen,
}: {
  item: Media;
  width: number;
  saved: boolean;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      testID={`image-tile-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${item.title}`}
      accessibilityHint={item.locked ? "Conhecer o acesso Premium" : "Abrir imagem ampliada"}
      onPress={onOpen}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        s.imageTile,
        { width, height: width },
        hovered && s.cardHovered,
        pressed && { opacity: 0.8 },
      ]}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityLabel={item.alt_text || item.title}
        />
      ) : (
        <View style={[s.lockedArtwork, StyleSheet.absoluteFill]}>
          <Icon name={item.locked ? "lock-closed-outline" : "image-outline"} size={24} color="#A36280" />
          {item.locked && <Text style={s.imageTilePremium}>Premium</Text>}
        </View>
      )}
      {saved && (
        <View style={s.imageTileSaved}>
          <Icon name="star" size={14} color={pink} />
        </View>
      )}
    </Pressable>
  );
}
export function MediaCard({
  item,
  width,
  saved,
  onOpen,
  onFavorite,
}: {
  item: Media;
  width: number;
  saved: boolean;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  const video = item.type !== "IMAGE";
  const compact = width < 220;
  const [hovered, setHovered] = useState(false);
  if (!video) {
    return <ImageTile item={item} width={width} saved={saved} onOpen={onOpen} />;
  }
  return (
    <View style={[s.card, { width }, hovered && s.cardHovered]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${item.title}`}
        onPress={onOpen}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          s.cardPicture,
          compact && { height: 155 },
          pressed && { opacity: 0.9 },
        ]}
      >
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            accessibilityLabel={item.alt_text || item.title}
          />
        ) : (
          <View style={[s.lockedArtwork, StyleSheet.absoluteFill]}>
            <View style={s.lockedRing} />
            <View style={s.lockCircle}>
              <Icon name="lock-closed-outline" size={27} color="#A36280" />
            </View>
            <Text style={s.lockedText}>Conteúdo Premium</Text>
          </View>
        )}
        <View style={s.cardBadge}>
          <Badge premium={item.access_type === "PREMIUM"} />
        </View>
        {video && !item.locked && (
          <View style={s.playCircle}>
            <Icon name="play" color={pink} size={22} />
          </View>
        )}
        <View style={s.duration}>
          <Icon
            name={video ? "videocam-outline" : "image-outline"}
            color="#fff"
            size={12}
          />
          <Text style={s.durationText}>
            {video ? duration(item.duration) : "Imagem"}
          </Text>
        </View>
      </Pressable>
      <View style={[s.cardBody, compact && { padding: 13 }]}>
        <Text style={s.cardCategory} numberOfLines={1}>
          {item.category_name || "Biblioteca"}
        </Text>
        <Text
          style={[s.cardTitle, compact && { fontSize: 14, lineHeight: 21 }]}
          numberOfLines={2}
        >
          {item.topic_title || item.title}
        </Text>
        <View style={s.cardBottom}>
          <Text style={s.cardMeta} numberOfLines={1}>
            {video
              ? "Vídeo de posicionamento"
              : item.title.split(" · ")[1] || "Imagem de posicionamento"}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              saved ? "Remover dos favoritos" : "Salvar nos favoritos"
            }
            onPress={onFavorite}
            style={({ pressed }) => [s.favoriteButton, pressed && s.pressed]}
            accessibilityState={{ selected: saved }}
          >
            <Icon
              name={saved ? "star" : "star-outline"}
              size={20}
              color={saved ? pink : "#8C7583"}
            />
          </Pressable>
        </View>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${item.locked ? "Conhecer Premium" : video ? "Assistir vídeo" : "Ver imagem"}: ${item.title}`}
          style={({ pressed }) => [s.cardAction, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.cardActionText}>
            {item.locked
              ? "Conhecer Premium"
              : video
                ? "Assistir vídeo"
                : "Ver imagem"}
          </Text>
          <Icon
            name={item.locked ? "lock-closed-outline" : "arrow-forward-outline"}
            color={pink}
            size={16}
          />
        </Pressable>
      </View>
    </View>
  );
}
