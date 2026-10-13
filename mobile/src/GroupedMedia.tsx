import React from "react";
import { Text, View } from "react-native";
import type { Media } from "./api";
import { MediaCard } from "./components";
import { s } from "./styles";

export default function GroupedMedia({
  items, imageWidth, videoWidth, favorites, onOpen, onFavorite, advertising,
}: {
  items: Media[];
  imageWidth: number;
  videoWidth: number;
  favorites: number[];
  onOpen: (item: Media) => void;
  onFavorite: (item: Media) => void;
  advertising?: React.ReactNode;
}) {
  // Preserve the API order, which also determines pagination boundaries.
  const groups = new Map<number | null, Media[]>();
  for (const item of items) {
    const group = groups.get(item.topic_id);
    if (group) group.push(item);
    else groups.set(item.topic_id, [item]);
  }
  const card = (item: Media, width: number) => (
    <MediaCard key={item.id} item={item} width={width}
      saved={favorites.includes(item.id)}
      onOpen={() => onOpen(item)} onFavorite={() => onFavorite(item)} />
  );
  return (
    <View style={s.positioningGroups}>
      {[...groups].map(([id, media], index) => {
        const images = media.filter((item) => item.type === "IMAGE");
        const videos = media.filter((item) => item.type !== "IMAGE");
        return (
          <React.Fragment key={id ?? "unassigned"}>
            <View testID={`positioning-group-${id ?? "unassigned"}`} style={s.positioningGroup}>
              <View style={s.positioningHeading}>
                <Text style={s.positioningCategory}>{media[0].category_name || "Biblioteca"}</Text>
                <Text accessibilityRole="header" style={s.positioningTitle}>{media[0].topic_title || "Outras mídias"}</Text>
              </View>
              {images.length > 0 && <View style={s.positioningSection}>
                <Text style={s.positioningMediaLabel}>Imagens · {images.length}</Text>
                <View testID={`positioning-images-${id ?? "unassigned"}`} style={s.grid}>{images.map((item) => card(item, imageWidth))}</View>
              </View>}
              {videos.length > 0 && <View style={s.positioningSection}>
                <Text style={s.positioningMediaLabel}>Vídeos · {videos.length}</Text>
                <View testID={`positioning-videos-${id ?? "unassigned"}`} style={s.grid}>{videos.map((item) => card(item, videoWidth))}</View>
              </View>}
            </View>
            {index === 0 && advertising}
          </React.Fragment>
        );
      })}
    </View>
  );
}
