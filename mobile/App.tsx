import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image as NativeImage,
  Linking,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { useFonts } from "expo-font";
import { useRouter, useSegments, useGlobalSearchParams } from "expo-router";
import {
  api,
  ApiError,
  Category,
  Content,
  Media,
  Page,
  restoreToken,
  setToken,
  setSessionExpiredHandler,
  Topic,
  User,
} from "./src/api";
import {
  Badge,
  Button,
  Icon,
  IconName,
  MediaCard,
  VideoPlayer,
} from "./src/components";
import { pink, s } from "./src/styles";
import {
  AdvertisingSlot,
  PartnersScreen,
  PartnerShortcut,
} from "./src/Partnerships";
import type { AdvertisingData } from "./src/advertisingTypes";
import { ps } from "./src/partnershipStyles";
import { recordSiteVisit } from "./src/siteAnalytics";
import ManualBody from "./src/ManualBody";
import GroupedMedia from "./src/GroupedMedia";
import PremiumPayment from "./src/PremiumPayment";
import PremiumTrial from "./src/PremiumTrial";
import AuthPanel from "./src/AuthPanel";
import CenteredModal from "./src/CenteredModal";
import useAuthKeyboard from "./src/useAuthKeyboard";
import { PlayBillingProvider } from "./src/PlayBilling";
type Screen =
  | "home"
  | "media"
  | "favorites"
  | "profile"
  | "topic"
  | "category"
  | "partners";
const nav: { id: Screen; label: string; icon: IconName }[] = [
  { id: "home", label: "Início", icon: "home-outline" },
  { id: "media", label: "Mídias", icon: "play-circle-outline" },
  { id: "favorites", label: "Favoritos", icon: "star-outline" },
  { id: "partners", label: "Parceiros", icon: "people-outline" },
  { id: "profile", label: "Perfil", icon: "person-outline" },
];
function AppContent() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= 1000;
  const wideColumns = width >= 1150 ? 3 : 2;
  const router = useRouter();
  const segments = useSegments();
  const routeParams = useGlobalSearchParams<{ id?: string }>();
  const routeScreen = (segments[0] || "home") as Screen;
  const setScreen = (next: Screen) => router.push(`/${next}`);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const lastTrackedPage = useRef("");
  const [stats, setStats] = useState({ images: 0, videos: 0, topics: 0 });
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionRetry, setSessionRetry] = useState(0);
  const screen: Screen = !user && !["home", "profile"].includes(routeScreen) ? "home" : routeScreen;
  const [items, setItems] = useState<Media[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [type, setType] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Media | null>(null);
  const [gallery, setGallery] = useState<Media[]>([]);
  const [zoom, setZoom] = useState(1);
  const [premium, setPremium] = useState(false);
  const activeTopic =
    screen === "topic"
      ? topics.find((topic) => String(topic.id) === routeParams.id) || null
      : null;
  const activeCategory =
    screen === "category"
      ? categories.find((category) => String(category.id) === routeParams.id) ||
        null
      : null;
  const [content, setContent] = useState<Content | null>(null);
  const visibleContent =
    activeTopic && content?.topic_id === activeTopic.id ? content : null;
  const [contentError, setContentError] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [topicTab, setTopicTab] = useState("Conteúdo");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [register, setRegister] = useState(true);
  const [authError, setAuthError] = useState("");
  const [authPrompt, setAuthPrompt] = useState(false);
  const [advertising, setAdvertising] = useState<AdvertisingData | null>(null);
  const [advertisingError, setAdvertisingError] = useState("");
  const libraryY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const authKeyboard = useAuthKeyboard(scrollRef, !user && screen === "profile");
  const hasPremium = !!user && (!!user.is_premium || user.role === "ADMIN");
  const promotePremium = !!user && user.role !== "ADMIN" && (!user.is_premium || !!user.trial_active);
  // Remove already-loaded advertisements immediately when access is granted.
  const visibleAdvertising = hasPremium && advertising ? {
    ...advertising, banners: [],
    settings: { ...advertising.settings, google_enabled: false, adsense_enabled: false },
  } : advertising;
  // Navigation and session changes never carry an open offer into the home screen.
  useEffect(() => { setPremium(false); }, [routeScreen, user?.id]);
  const history = useRef<Screen[]>([]);
  const requestKey = useRef(0);
  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }
  function onTrialStarted() {
    setPremium(false);
    setRefresh((n) => n + 1);
    notify("Seu período de teste começou. Bons estudos!");
  }
  function navigate(next: Screen) {
    if (!user) { setAuthPrompt(true); return; }
    if (next !== screen) history.current.push(screen);
    setScreen(next);
    setPage(1);
    setError("");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function goBack() {
    if (authPrompt) { setAuthPrompt(false); return; }
    if (selected) {
      setSelected(null);
      return;
    }
    if (premium) {
      setPremium(false);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/home");
    setPage(1);
  }
  useEffect(() => {
    if (!ready || !settings.app_name || user?.role === "ADMIN") return;
    if (typeof document !== "undefined") document.title = settings.app_name;
    if (settings.analytics_enabled === "0") return;
    const key = `${screen}:${routeParams.id || ""}`;
    if (lastTrackedPage.current === key) return;
    const timer = setTimeout(() => {
      lastTrackedPage.current = key;
      recordSiteVisit(screen);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    ready,
    screen,
    routeParams.id,
    settings.app_name,
    settings.analytics_enabled,
    user?.role,
  ]);
  useEffect(() => {
    setSessionExpiredHandler(() => {
      void setToken("");
      setUser(null);
      setSelected(null);
      setPremium(false);
      setItems([]);
      setContent(null);
      setAuthError("Sua sessão expirou. Entre novamente para continuar.");
      setRegister(false);
    });
    return () => setSessionExpiredHandler();
  }, []);
  useEffect(() => {
    if (ready && !sessionError && !user && !["home", "profile"].includes(routeScreen)) {
      router.replace("/home");
      setAuthPrompt(true);
    }
  }, [ready, sessionError, user, routeScreen, router]);
  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    const syncProfile = () => {
      api<User>("/profile")
        .then((profile) => {
          if (!active || profile.id !== user.id) return;
          if (profile.is_premium !== user.is_premium || profile.role !== user.role || profile.name !== user.name
            || profile.trial_active !== user.trial_active || profile.trial_ends_at !== user.trial_ends_at
            || profile.trial_available !== user.trial_available || profile.trial_days !== user.trial_days
            || profile.premium_permanent !== user.premium_permanent)
            setUser(profile);
          if (user.is_premium && !profile.is_premium && profile.role !== "ADMIN") {
            setSelected(null);
            setContent(null);
          }
        })
        .catch(() => {});
    };
    const trialEnd = user.trial_active && user.trial_ends_at ? Date.parse(user.trial_ends_at) : NaN;
    const expireTrial = () => {
      if (Number.isFinite(trialEnd) && Date.now() >= trialEnd && !user.premium_permanent) {
        setUser((previous) => previous?.id === user.id && previous.trial_active && !previous.premium_permanent
          ? { ...previous, trial_active: false, is_premium: 0 } : previous);
        setSelected(null);
        setContent(null);
        syncProfile();
      }
    };
    const interval = user.trial_active ? setInterval(() => { expireTrial(); syncProfile(); }, 60000) : null;
    const expiryTimer = Number.isFinite(trialEnd)
      ? setTimeout(expireTrial, Math.max(0, Math.min(trialEnd - Date.now(), 2147483647))) : null;
    const cleanup = () => {
      active = false;
      if (interval) clearInterval(interval);
      if (expiryTimer) clearTimeout(expiryTimer);
    };
    if (Platform.OS === "web") {
      const onVisible = () => {
        if (document.visibilityState === "visible") { expireTrial(); syncProfile(); }
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => { cleanup(); document.removeEventListener("visibilitychange", onVisible); };
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { expireTrial(); syncProfile(); }
    });
    return () => { cleanup(); subscription.remove(); };
  }, [ready, user]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [screen, selected, premium, authPrompt]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      setSessionError("");
      try {
        const restored = await restoreToken();
        const profile = restored ? await api<User>("/profile") : null;
        if (cancelled) return;
        setUser(profile);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          await setToken("");
          setUser(null);
          setRegister(false);
        } else setSessionError((error as Error).message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionRetry]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    Promise.all([
      api<Category[]>("/categories"),
      api<Topic[]>("/topics"),
      api<Record<string, string>>("/settings"),
      api<typeof stats>("/stats"),
    ])
      .then(([c, t, se, st]) => {
        if (cancelled) return;
        setError("");
        setCategories(c);
        setTopics(t);
        setSettings(se);
        setStats(st);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, refresh, user]);
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    setAdvertising(null);
    setAdvertisingError("");
    api<AdvertisingData>("/advertising")
      .then((data) => {
        if (!cancelled) setAdvertising(data);
      })
      .catch(() => {
        if (!cancelled)
          setAdvertisingError("Não foi possível carregar as parcerias.");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, refresh, user, screen]);
  useEffect(() => {
    if (user)
      api<number[]>("/favorites/ids")
        .then(setFavorites)
        .catch(() => setFavorites([]));
    else setFavorites([]);
  }, [user]);
  useEffect(() => {
    if (!ready || !user || !["media", "favorites", "topic"].includes(screen)) return;
    if (screen === "favorites" && !user) {
      setItems([]);
      setTotal(0);
      setPages(0);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    const key = ++requestKey.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: screen === "media" && !type ? "100" : "24",
    });
    if (type && screen !== "topic") params.set("type", type);
    if (debounced && screen === "media") params.set("q", debounced);
    if (category && screen === "media")
      params.set("category_id", String(category));
    if (screen === "topic" && activeTopic) {
      params.set("topic_id", String(activeTopic.id));
      if (topicTab !== "Conteúdo")
        params.set("type", topicTab === "Imagens" ? "IMAGE" : "VIDEO");
    }
    api<Page>(`${screen === "favorites" ? "/favorites" : "/media"}?${params}`, {
      signal: abort.signal,
    })
      .then((result) => {
        if (key !== requestKey.current) return;
        setItems(result.data);
        setTotal(result.total);
        setPages(result.pages);
      })
      .catch((e) => {
        if (e.name !== "AbortError" && key === requestKey.current)
          setError(e.message);
      })
      .finally(() => {
        if (key === requestKey.current) setLoading(false);
      });
    return () => abort.abort();
  }, [
    ready,
    screen,
    user,
    page,
    type,
    category,
    debounced,
    refresh,
    activeTopic,
    topicTab,
  ]);
  useEffect(() => {
    if (!user || screen !== "topic" || !activeTopic) return;
    let cancelled = false;
    setContent(null);
    setContentError("");
    setContentLoading(true);
    api<Content>(`/contents/${activeTopic.id}`)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e) => {
        if (!cancelled) setContentError(e.message);
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [screen, activeTopic, user, refresh]);
  async function openMedia(item: Media) {
    if (!user) { setAuthPrompt(true); return; }
    if (item.locked) {
      setPremium(true);
      return;
    }
    try {
      const fresh = await api<Media>(`/media/${item.id}`);
      if (fresh.locked) {
        setPremium(true);
        return;
      }
      setSelected(fresh);
      setZoom(1);
      setGallery([]);
      if (item.type === "IMAGE" && item.topic_id) {
        const result = await api<Page>(
          `/media?topic_id=${item.topic_id}&type=IMAGE&limit=100`,
        );
        setGallery(result.data.filter((m) => !m.locked));
      }
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function galleryMove(direction: number) {
    const next =
      gallery[gallery.findIndex((m) => m.id === selected?.id) + direction];
    if (next)
      try {
        setSelected(await api<Media>(`/media/${next.id}`));
        setZoom(1);
      } catch (e) {
        notify((e as Error).message);
      }
  }
  async function favorite(item: Media) {
    if (!user) {
      notify("Entre na sua conta para salvar seus favoritos.");
      navigate("profile");
      return;
    }
    const exists = favorites.includes(item.id);
    try {
      await api(`/favorites/${item.id}`, {
        method: exists ? "DELETE" : "POST",
      });
      setFavorites((prev) =>
        exists ? prev.filter((id) => id !== item.id) : [...prev, item.id],
      );
      if (screen === "favorites") setRefresh((r) => r + 1);
      notify(exists ? "Removido dos favoritos." : "Salvo nos seus favoritos.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function beginAuth(createAccount: boolean) {
    setRegister(createAccount); setAuthError(""); setAuthPrompt(false);
    router.push("/profile");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function authenticated(profile: User) {
    setUser(profile); setPremium(false); setAuthPrompt(false);
    router.replace("/home");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    notify(`Bem-vindo, ${profile.name.split(" ")[0]}!`);
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      await setToken("");
      setUser(null);
      setSelected(null);
      setPremium(false);
      setItems([]);
      setContent(null);
      setRegister(false);
      router.replace("/home");
      notify("Você saiu da sua conta.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function openTopic(topic: Topic) {
    if (!user) { setAuthPrompt(true); return; }
    if (topic.access_type === "PREMIUM" && !hasPremium) {
      setPremium(true);
      return;
    }
    setTopicTab("Conteúdo");
    setPage(1);
    router.push({ pathname: "/topic", params: { id: topic.id } });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  const title =
    screen === "media"
      ? "Sua biblioteca de aprendizado"
      : screen === "home"
        ? "Conhecimento que transforma"
        : screen === "favorites"
          ? "Seus conteúdos favoritos"
          : screen === "profile"
            ? "Seu espaço de aprendizado"
            : screen === "partners"
              ? "Nosso espaço de conexões"
              : screen === "category"
                ? activeCategory?.name
                : activeTopic?.title;
  const gridWidth = desktop ? Math.min(width - 304, 1100) : width - 40;
  const columns = width < 600 ? 1 : wideColumns;
  const cardWidth = (gridWidth - (columns - 1) * 16) / columns;
  const imageColumns = width < 600 ? 3 : width < 1000 ? 4 : 6;
  const imageWidth = Math.floor((gridWidth - (imageColumns - 1) * 16) / imageColumns);
  const showGrid =
    ["media", "favorites"].includes(screen) ||
    (screen === "topic" && topicTab !== "Conteúdo");
  const galleryIndex = gallery.findIndex((m) => m.id === selected?.id);
  if (!ready || sessionError) return (
    <SafeAreaView style={[s.safe, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
      <StatusBar style="dark" />
      <NativeImage source={require("./assets/brand.png")} style={{ width: 235, height: 80 }} resizeMode="contain" />
      {sessionError ? <>
        <Text style={[s.error, { marginVertical: 24, textAlign: "center" }]}>{sessionError}</Text>
        <Button label="Tentar novamente" onPress={() => setSessionRetry((n) => n + 1)} />
      </> : <ActivityIndicator color={pink} style={{ marginTop: 24 }} />}
    </SafeAreaView>
  );
  return (
    <PlayBillingProvider user={user} onUser={setUser} onPaid={() => {
      setPremium(false);
      setRefresh((n) => n + 1);
      notify("Premium liberado! Bons estudos.");
    }}>
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={s.shell}>
        {desktop && (user || screen === "home") && (
          <View style={s.sidebar}>
            <NativeImage
              source={require("./assets/brand.png")}
              style={s.sidebarLogo}
              resizeMode="contain"
            />
            <View style={s.divider} />
            <Text style={s.sideEyebrow}>SEU APRENDIZADO</Text>
            {nav.map((n) => (
              <Pressable
                key={n.id}
                accessibilityLabel={n.label}
                onPress={() => navigate(n.id)}
                style={[s.sideNav, screen === n.id && s.sideActive]}
                accessibilityRole="button"
              >
                <Icon
                  name={n.icon}
                  color={screen === n.id ? pink : "#796772"}
                />
                <Text
                  style={[
                    s.sideNavText,
                    screen === n.id && { color: pink, fontFamily: "DMSans700" },
                  ]}
                >
                  {n.label}
                </Text>
                {screen === n.id && <View style={s.navDot} />}
              </Pressable>
            ))}
            <View style={{ flex: 1 }} />
            {promotePremium && <View style={s.sidePremium}>
              <Icon name="sparkles-outline" color={pink} size={25} />
              <Text style={s.sidePremiumTitle}>Vá além com o Premium</Text>
              <Text style={s.sidePremiumCopy}>
                Todos os conteúdos e uma experiência sem anúncios.
              </Text>
              <Button
                label="Conhecer Premium"
                onPress={() => setPremium(true)}
                secondary
              />
            </View>}
            <Text style={s.sidebarFooter}>APRENDER. PRATICAR. EVOLUIR.</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View
            style={[
              s.topbar,
              !desktop && { paddingHorizontal: 20, height: 66 },
            ]}
          >
            {desktop && user ? (
              <View style={s.row}>
                <Text style={s.breadcrumb}>Meu aprendizado</Text>
                <Icon name="chevron-forward" size={12} />
                <Text style={s.breadcrumbCurrent}>
                  {nav.find((n) => n.id === screen)?.label || "Posicionamentos"}
                </Text>
              </View>
            ) : (
              <View style={s.row}>
                {(screen === "category" || screen === "topic" || (!user && screen === "profile")) && (
                  <Pressable
                    onPress={goBack}
                    accessibilityRole="button"
                    accessibilityLabel="Voltar"
                    style={{ padding: 10 }}
                  >
                    <Icon name="arrow-back" />
                  </Pressable>
                )}
                <NativeImage
                  source={require("./assets/brand.png")}
                  style={{
                    width:
                      screen === "category" || screen === "topic" ? 150 : 194,
                    height: 57,
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={s.row}>
              {desktop && (
                <View style={s.topPill}>
                  <View style={s.greenDot} />
                  <Text style={s.topPillText}>Um passo a mais a cada dia</Text>
                </View>
              )}
              <Pressable
                onPress={() => navigate("profile")}
                accessibilityRole="button"
                accessibilityLabel="Abrir perfil"
                style={s.avatar}
              >
                {user ? (
                  <Text style={s.avatarText}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </Text>
                ) : (
                  <Icon name="person-outline" color={pink} />
                )}
              </Pressable>
            </View>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} enabled={!user && Platform.OS === "ios"}
            behavior="padding" keyboardVerticalOffset={insets.top + (desktop ? 76 : 66)}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              s.scrollContent,
              {
                paddingHorizontal: desktop ? 32 : 20,
                paddingTop: desktop ? 32 : 24,
                paddingBottom: 28 + authKeyboard.bottomSpace,
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={authKeyboard.onScroll}
            scrollEventThrottle={16}
            onLayout={(event) => authKeyboard.onLayout(event.nativeEvent.layout.height)}
            onContentSizeChange={authKeyboard.onContentSizeChange}
          >
            <View style={s.content}>
              {(user || screen !== "profile") && <View style={[s.pageHeading, !desktop && { marginBottom: 20 }]}>
                <View style={{ flex: 1 }}>
                  <View style={[s.eyebrowRow, screen === "profile" && { justifyContent: "center" }]}>
                    <View style={s.pinkLine} />
                    <Text style={s.eyebrow}>
                      {screen === "media"
                        ? "SUA BIBLIOTECA VISUAL"
                        : "DOMINANDO A MAMOGRAFIA"}
                    </Text>
                  </View>
                  {user && screen !== "home" && (
                    <Text
                      style={[
                        s.pageTitle,
                        screen === "profile" && { textAlign: "center" },
                        !desktop && {
                          fontSize: 27,
                          lineHeight: 35,
                          letterSpacing: -0.8,
                        },
                      ]}
                    >
                      {screen === "media" && !desktop
                        ? "Biblioteca de mídias"
                        : title}
                    </Text>
                  )}
                  {(user || screen === "home") && <Text style={[s.pageSubtitle, screen === "profile" && { textAlign: "center" }]}>
                    {screen === "media"
                      ? desktop
                        ? "Um novo olhar para cada etapa do seu aprendizado."
                        : "Imagens e vídeos para estudar com clareza."
                      : screen === "favorites"
                        ? "Tudo o que você salvou, reunido em um só lugar."
                        : screen === "profile"
                          ? "Acompanhe sua conta e continue evoluindo."
                          : screen === "partners"
                            ? "Marcas, oportunidades e novos caminhos."
                            : screen === "topic"
                              ? activeTopic?.category_name
                              : "Seu guia de posicionamento, sempre por perto."}
                  </Text>}
                </View>
                {desktop && screen === "media" && (
                  <View style={s.headingIcon}>
                    <Icon name="albums-outline" color={pink} size={25} />
                  </View>
                )}
              </View>}
              {(screen === "home" || screen === "category") && (
                <View style={{ gap: 14 }}>
                  {screen === "home" && (
                    <>
                      <View style={ps.quickRow}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Estudar com vídeos"
                          onPress={() => {
                            setType("VIDEO");
                            navigate("media");
                          }}
                          style={({ pressed }) => [
                            ps.quickCard,
                            pressed && s.pressed,
                          ]}
                        >
                          <Icon name="play-circle" color={pink} size={28} />
                          <Text style={ps.quickTitle}>Vídeos na prática</Text>
                          <Text style={ps.quickCopy}>
                            {stats.videos} vídeos
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Revisar imagens"
                          onPress={() => {
                            setType("IMAGE");
                            navigate("media");
                          }}
                          style={({ pressed }) => [
                            ps.quickCard,
                            pressed && s.pressed,
                          ]}
                        >
                          <Icon name="images" color="#547461" size={27} />
                          <Text style={ps.quickTitle}>Imagens</Text>
                          <Text style={ps.quickCopy}>
                            {stats.images} imagens
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                  <View
                    style={screen === "home" ? ps.homeCategories : { gap: 14 }}
                  >
                    {screen === "home"
                      ? categories.map((c) => (
                          <Pressable
                            key={c.id}
                            testID={`home-module-${c.id}`}
                            style={({ pressed }) => [
                              ps.category,
                              pressed && s.pressed,
                            ]}
                            onPress={() => {
                              if (!user) { setAuthPrompt(true); return; }
                              if (c.access_type === "PREMIUM" && !hasPremium) {
                                setPremium(true);
                                return;
                              }
                              setPage(1);
                              router.push({
                                pathname: "/category",
                                params: { id: c.id },
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={c.name}
                          >
                            <Text style={ps.categoryTitle}>{c.name}</Text>
                            <View>
                              <Badge premium={c.access_type === "PREMIUM"} />
                            </View>
                            <Icon name="arrow-forward" size={18} color={pink} />
                          </Pressable>
                        ))
                      : topics
                          .filter((t) => t.category_id === activeCategory?.id)
                          .map((t) => (
                            <Pressable
                              key={t.id}
                              style={s.categoryCard}
                              onPress={() => openTopic(t)}
                              accessibilityRole="button"
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={s.cardTitle}>{t.title}</Text>
                              </View>
                              <Badge premium={t.access_type === "PREMIUM"} />
                              <Icon name="chevron-forward" size={18} />
                            </Pressable>
                          ))}
                  </View>
                  {screen === "home" && (
                    <>
                      <AdvertisingSlot
                        data={visibleAdvertising}
                        placement="HOME"
                        onError={notify}
                      />
                      <PartnerShortcut onPress={() => navigate("partners")} />
                    </>
                  )}
                </View>
              )}
              {screen === "partners" &&
                (advertisingError ? (
                  <View style={s.empty}>
                    <Icon name="cloud-offline-outline" size={35} color={pink} />
                    <Text style={s.emptyCopy}>{advertisingError}</Text>
                    <Button
                      label="Tentar novamente"
                      onPress={() => setRefresh((n) => n + 1)}
                    />
                  </View>
                ) : advertising ? (
                  <PartnersScreen data={visibleAdvertising} onError={notify} />
                ) : (
                  <View style={s.loading}>
                    <ActivityIndicator color={pink} />
                    <Text style={s.subtle}>Carregando conexões...</Text>
                  </View>
                ))}
              {screen === "topic" && (
                <>
                  <View style={s.tabs}>
                    {["Conteúdo", "Vídeos", "Imagens"].map((tab) => (
                      <Pressable
                        key={tab}
                        style={[s.tab, topicTab === tab && s.activeTab]}
                        onPress={() => {
                          setTopicTab(tab);
                          setPage(1);
                        }}
                      >
                        <Text
                          style={[
                            s.tabText,
                            topicTab === tab && { color: pink },
                          ]}
                        >
                          {tab}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {topicTab === "Conteúdo" &&
                    (contentLoading || (!visibleContent && !contentError) ? (
                      <ActivityIndicator color={pink} style={{ padding: 50 }} />
                    ) : contentError ? (
                      <View style={s.empty}>
                        <Icon
                          name="lock-closed-outline"
                          size={38}
                          color={pink}
                        />
                        <Text style={s.emptyTitle}>{contentError}</Text>
                        <Button
                          label="Conhecer Premium"
                          onPress={() => setPremium(true)}
                        />
                      </View>
                    ) : (
                      <View testID={`manual-content-${visibleContent?.topic_id}`} style={s.article}>
                        {visibleContent?.blocks.map((block) => (
                          <View
                            key={block.id}
                            style={[
                              s.articleBlock,
                              ["important", "tip", "common_errors"].includes(
                                block.type,
                              ) && s.articleHighlight,
                              block.type === "common_errors" &&
                                s.articleWarning,
                            ]}
                          >
                            {block.title && (
                              <View style={s.row}>
                                <Icon
                                  name={
                                    block.type === "tip"
                                      ? "bulb-outline"
                                      : block.type === "important"
                                        ? "information-circle-outline"
                                        : block.type === "common_errors"
                                          ? "warning-outline"
                                          : block.type === "quality_criteria"
                                            ? "checkmark-circle-outline"
                                            : block.type === "numbered_list"
                                              ? "list-outline"
                                              : "reader-outline"
                                  }
                                  color={pink}
                                  size={21}
                                />
                                <Text style={[s.articleHeading, { flex: 1 }]}>
                                  {block.title}
                                </Text>
                              </View>
                            )}
                            <ManualBody block={block} />
                          </View>
                        ))}
                      </View>
                    ))}
                </>
              )}
              {showGrid && (
                <>
                  {screen === "media" && (
                    <>
                      <View
                        onLayout={(event) => {
                          libraryY.current = event.nativeEvent.layout.y;
                        }}
                        style={[
                          s.tools,
                          !desktop && {
                            flexDirection: "column-reverse",
                            alignItems: "stretch",
                            gap: 12,
                          },
                        ]}
                      >
                        <View
                          style={[s.tabs, !desktop && { alignSelf: "stretch" }]}
                        >
                          {[
                            {
                              id: "",
                              label: "Todas as mídias",
                              icon: "grid-outline",
                            },
                            {
                              id: "VIDEO",
                              label: "Vídeos",
                              icon: "videocam-outline",
                            },
                            {
                              id: "IMAGE",
                              label: "Imagens",
                              icon: "image-outline",
                            },
                          ].map((t) => (
                            <Pressable
                              key={t.id}
                              accessibilityLabel={t.label}
                              accessibilityRole="tab"
                              accessibilityState={{ selected: type === t.id }}
                              onPress={() => {
                                setType(t.id);
                                setPage(1);
                              }}
                              style={[
                                s.tab,
                                !desktop && { flex: 1, paddingHorizontal: 8 },
                                type === t.id && s.activeTab,
                              ]}
                            >
                              <Icon
                                name={t.icon as IconName}
                                size={16}
                                color={type === t.id ? pink : "#706570"}
                              />
                              <Text
                                style={[
                                  s.tabText,
                                  type === t.id && { color: pink },
                                ]}
                              >
                                {!desktop && t.id === "" ? "Todas" : t.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={[s.search, desktop && { width: 305 }]}>
                          <Icon name="search-outline" size={18} />
                          <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Buscar posicionamento..."
                            placeholderTextColor="#8A7C85"
                            style={s.searchInput}
                            accessibilityLabel="Buscar mídias"
                          />
                          {search.length > 0 && (
                            <Pressable
                              onPress={() => setSearch("")}
                              accessibilityLabel="Limpar busca"
                            >
                              <Icon name="close-circle" size={18} />
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.filters}
                      >
                        {[
                          { id: null, name: "Todas as categorias" },
                          ...categories.filter(
                            (c) => Number(c.topic_count) > 0,
                          ),
                        ].map((c) => (
                          <Pressable
                            key={String(c.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: category === c.id }}
                            onPress={() => {
                              setCategory(c.id);
                              setPage(1);
                            }}
                            style={[s.chip, category === c.id && s.activeChip]}
                          >
                            <Icon
                              name={
                                c.id === null
                                  ? "options-outline"
                                  : ((categories.find((cat) => cat.id === c.id)
                                      ?.icon || "folder-outline") as IconName)
                              }
                              color={category === c.id ? "#fff" : "#8A6D7C"}
                              size={14}
                            />
                            <Text
                              style={[
                                s.chipText,
                                category === c.id && { color: "#fff" },
                              ]}
                            >
                              {c.name}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </>
                  )}
                  <View style={s.resultsHeading}>
                    <Text style={s.sectionTitle}>
                      {screen === "favorites"
                        ? "Minha coleção"
                        : screen === "topic"
                          ? topicTab
                          : type === "VIDEO"
                            ? "Vídeos de posicionamento"
                            : type === "IMAGE"
                              ? "Galeria de imagens"
                              : "Explore a biblioteca"}
                    </Text>
                    <Text style={s.resultsCount}>
                      {total} {total === 1 ? "mídia" : "mídias"}
                    </Text>
                  </View>
                  {screen === "media" &&
                    (category !== null || search.length > 0) && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setSearch("");
                          setCategory(null);
                          setPage(1);
                        }}
                        style={s.filterReset}
                      >
                        <Icon
                          name="close-circle-outline"
                          color={pink}
                          size={16}
                        />
                        <Text style={s.textLink}>Limpar filtros</Text>
                      </Pressable>
                    )}
                  {screen === "favorites" && !user ? (
                    <View style={s.empty}>
                      <Text style={s.emptyCopy}>
                        Entre na sua conta para salvar imagens e vídeos e
                        encontrá-los facilmente depois.
                      </Text>
                      <Button
                        label="Entrar na minha conta"
                        onPress={() => navigate("profile")}
                      />
                    </View>
                  ) : loading ? (
                    <View style={s.loading}>
                      <ActivityIndicator size="large" color={pink} />
                      <Text style={s.subtle}>
                        Organizando sua biblioteca...
                      </Text>
                    </View>
                  ) : error ? (
                    <View style={s.empty}>
                      <Icon
                        name="cloud-offline-outline"
                        size={38}
                        color={pink}
                      />
                      <Text style={s.emptyTitle}>
                        Não foi possível carregar a biblioteca
                      </Text>
                      <Text style={s.emptyCopy}>{error}</Text>
                      <Button
                        label="Tentar novamente"
                        onPress={() => setRefresh((r) => r + 1)}
                      />
                    </View>
                  ) : items.length === 0 ? (
                    <View style={s.empty}>
                      <Icon
                        name={
                          screen === "favorites"
                            ? "star-outline"
                            : "search-outline"
                        }
                        size={40}
                        color={pink}
                      />
                      <Text style={s.emptyTitle}>
                        {screen === "favorites"
                          ? "Sua coleção começa aqui"
                          : "Nenhuma mídia encontrada"}
                      </Text>
                      <Text style={s.emptyCopy}>
                        {screen === "favorites"
                          ? "Toque na estrela de uma mídia para salvá-la."
                          : "Experimente outro termo ou ajuste os filtros."}
                      </Text>
                      <Button
                        label={
                          screen === "favorites"
                            ? "Explorar mídias"
                            : "Limpar filtros"
                        }
                        secondary
                        onPress={() => {
                          setSearch("");
                          setCategory(null);
                          setType("");
                          if (screen === "favorites") navigate("media");
                        }}
                      />
                    </View>
                  ) : screen === "media" && !type ? (
                    <GroupedMedia
                      items={items}
                      imageWidth={imageWidth}
                      videoWidth={cardWidth}
                      favorites={favorites}
                      onOpen={openMedia}
                      onFavorite={favorite}
                      advertising={<AdvertisingSlot data={visibleAdvertising} placement="MEDIA" onError={notify} />}
                    />
                  ) : (
                    <View style={s.grid}>
                      {items.map((item, index) => (
                        <React.Fragment key={item.id}>
                          <MediaCard
                            item={item}
                            width={item.type === "IMAGE" ? imageWidth : cardWidth}
                            saved={favorites.includes(item.id)}
                            onOpen={() => openMedia(item)}
                            onFavorite={() => favorite(item)}
                          />
                          {screen === "media" &&
                            index === Math.min(5, items.length - 1) && (
                              <View style={{ width: gridWidth }}>
                                <AdvertisingSlot
                                  data={visibleAdvertising}
                                  placement="MEDIA"
                                  onError={notify}
                                />
                              </View>
                            )}
                        </React.Fragment>
                      ))}
                    </View>
                  )}
                  {!loading && pages > 1 && (
                    <View style={s.pagination}>
                      <Button
                        secondary
                        label="Anterior"
                        disabled={page <= 1}
                        onPress={() => {
                          setPage((p) => p - 1);
                          scrollRef.current?.scrollTo({
                            y: screen === "media" ? libraryY.current : 0,
                            animated: true,
                          });
                        }}
                      />
                      <Text style={s.subtle}>
                        {page} de {pages}
                      </Text>
                      <Button
                        secondary
                        label="Próxima"
                        disabled={page >= pages}
                        onPress={() => {
                          setPage((p) => p + 1);
                          scrollRef.current?.scrollTo({
                            y: screen === "media" ? libraryY.current : 0,
                            animated: true,
                          });
                        }}
                      />
                    </View>
                  )}
                </>
              )}
              {screen === "profile" && (
                <View style={user ? s.profile : s.authContainer}>
                  {user ? (
                    <>
                      <View style={s.largeAvatar}>
                        <Text
                          style={{
                            fontSize: 26,
                            color: pink,
                            fontWeight: "700",
                          }}
                        >
                          {user.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={s.profileTitle}>{user.name}</Text>
                      <Text style={[s.subtle, s.profileCopy]}>{user.email}</Text>
                      <View style={s.profileBadge}>
                      <Badge
                        premium={
                          Boolean(user.is_premium) || user.role === "ADMIN"
                        }
                      />
                      </View>
                      {user.trial_active && user.trial_ends_at && <Text style={[s.subtle, s.profileCopy]}>
                        Premium em teste até {new Date(user.trial_ends_at).toLocaleString("pt-BR")}.
                        {"\n"}Ao terminar, você pode comprar o acesso definitivo. Não há cobrança automática.
                      </Text>}
                      {!user.trial_active && !user.is_premium && user.trial_ends_at && <Text style={[s.subtle, s.profileCopy]}>
                        Seu período de teste terminou. Os conteúdos gratuitos continuam disponíveis.
                      </Text>}
                      <PremiumTrial key={user.id} user={user} onUser={setUser} onStarted={onTrialStarted} />
                      {user.role === "ADMIN" && (
                        <Text style={s.profileAdmin}>
                          Conta administrativa: você pode revisar todas as
                          mídias.
                        </Text>
                      )}
                      <View style={s.profileActions}>
                      <Button
                        label="Explorar biblioteca"
                        onPress={() => navigate("media")}
                        icon="albums-outline"
                      />
                      {(!user.is_premium || user.trial_active) && user.role !== "ADMIN" && <Button
                        label="Conhecer Premium"
                        secondary
                        onPress={() => setPremium(true)}
                      />}
                      <Button
                        label="Sair da conta"
                        secondary
                        onPress={logout}
                      />
                      </View>
                    </>
                  ) : (
                    <AuthPanel key={register ? "register" : "login"} initialMode={register ? "register" : "login"}
                      initialError={authError} onAuthenticated={authenticated} onFocus={authKeyboard.onFocus} />
                  )}
                </View>
              )}
              {screen === "topic" &&
                topicTab === "Conteúdo" &&
                !contentLoading &&
                visibleContent &&
                !contentError && (
                  <AdvertisingSlot
                    data={visibleAdvertising}
                    placement="CONTENT"
                    onError={notify}
                  />
                )}
              {screen === "media" && (
                <PartnerShortcut onPress={() => navigate("partners")} />
              )}
              {error && !showGrid && <View style={{ gap: 12 }}>
                <Text style={s.error}>{error}</Text>
                <Button label="Tentar novamente" secondary onPress={() => setRefresh((n) => n + 1)} />
              </View>}
              {user && <View style={s.footer}>
                <View style={s.row}>
                  <Icon name="heart-outline" color={pink} size={15} />
                  <Text style={s.footerBrand}>
                    {settings.app_name || "Dominando a Mamografia"}
                  </Text>
                </View>
                <Text style={s.footerNotice}>
                  {settings.footer_notice || "Carregando aviso educacional..."}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 18,
                    marginTop: 12,
                  }}
                >
                  {[
                    {
                      label: "Suporte",
                      url: settings.support_email
                        ? `mailto:${settings.support_email}`
                        : "",
                    },
                    { label: "Privacidade", url: settings.privacy_url },
                    { label: "Termos de uso", url: settings.terms_url },
                  ]
                    .filter((link) => link.url)
                    .map((link) => (
                      <Pressable
                        key={link.label}
                        accessibilityRole="link"
                        onPress={() =>
                          Linking.openURL(link.url).catch(() =>
                            notify("Não foi possível abrir este link."),
                          )
                        }
                      >
                        <Text
                          style={[
                            s.footerNotice,
                            { color: pink, textDecorationLine: "underline" },
                          ]}
                        >
                          {link.label}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>}
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
          {!user && screen === "home" && <Pressable accessibilityRole="button" accessibilityLabel="Começar gratuitamente"
            onPress={() => setAuthPrompt(true)} style={({ pressed }) => [s.guestCallout, pressed && s.pressed]}>
            <Icon name="person-add-outline" color={pink} size={22} />
            <View style={{ flex: 1 }}><Text style={s.guestCalloutTitle}>Seu aprendizado começa aqui</Text>
              <Text style={s.guestCalloutCopy}>Crie sua conta gratuita para continuar</Text></View>
            <Icon name="arrow-forward" color={pink} size={20} />
          </Pressable>}
          {!desktop && promotePremium && <Pressable
            accessibilityRole="button" accessibilityLabel="Quero ser Premium"
            onPress={() => setPremium(true)}
            style={({ pressed }) => [s.premiumCallout, pressed && s.pressed]}>
            <Icon name="sparkles-outline" color="#FFF" size={22} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.premiumCalloutTitle}>Quero ser Premium</Text>
              <Text style={s.premiumCalloutCopy}>Acesso completo • Sem anúncios</Text>
            </View>
            <Icon name="arrow-forward" color="#FFF" size={20} />
          </Pressable>}
          {!desktop && (user || screen === "home") && (
            <View style={s.bottomNav}>
              {nav.map((n) => (
                <Pressable
                  key={n.id}
                  style={s.bottomItem}
                  onPress={() => navigate(n.id)}
                  accessibilityRole="button"
                  accessibilityLabel={n.label}
                  accessibilityState={{ selected: screen === n.id }}
                >
                  <View
                    style={[
                      s.bottomIcon,
                      screen === n.id && s.bottomIconActive,
                    ]}
                  >
                    <Icon
                      name={
                        screen === n.id
                          ? (n.icon.replace("-outline", "") as IconName)
                          : n.icon
                      }
                      color={screen === n.id ? pink : "#796772"}
                      size={21}
                    />
                  </View>
                  <Text
                    style={[s.bottomLabel, screen === n.id && { color: pink }]}
                  >
                    {n.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
      {toast !== "" && (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
          <Pressable onPress={() => setToast("")}>
            <Icon name="close" color="#fff" size={18} />
          </Pressable>
        </View>
      )}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.backdrop}>
          <View
            style={[
              s.viewer,
              { width: Math.min(width - 24, 980), maxHeight: height - 40 },
            ]}
          >
            {selected && (
              <>
                <View style={s.viewerHeader}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={s.cardCategory}>{selected.category_name}</Text>
                    <Text style={s.viewerTitle}>{selected.title}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Fechar mídia"
                    accessibilityRole="button"
                    style={s.close}
                    onPress={() => setSelected(null)}
                  >
                    <Icon name="close" size={23} />
                  </Pressable>
                </View>
                <ScrollView>
                  {selected.type === "IMAGE" ? (
                    <ScrollView
                      horizontal
                      contentContainerStyle={{
                        minWidth: "100%",
                        justifyContent: "center",
                        backgroundColor: "#202026",
                      }}
                    >
                      <ScrollView
                        style={{ maxHeight: Math.min(height * 0.55, 520) }}
                      >
                        <Image
                          source={{ uri: selected.url! }}
                          style={{
                            width: Math.min(width - 60, 900) * zoom,
                            height: Math.min(height * 0.55, 520) * zoom,
                          }}
                          contentFit="contain"
                          accessibilityLabel={
                            selected.alt_text || selected.title
                          }
                        />
                      </ScrollView>
                    </ScrollView>
                  ) : selected.type === "VIDEO_URL" ? (
                    <View style={s.empty}>
                      <Icon name="videocam-outline" size={40} color={pink} />
                      <Text style={s.emptyTitle}>{selected.topic_title}</Text>
                      <Button
                        label="Abrir vídeo externo"
                        icon="open-outline"
                        onPress={() =>
                          Linking.openURL(selected.url!).catch(() =>
                            notify("Não foi possível abrir o vídeo."),
                          )
                        }
                      />
                    </View>
                  ) : (
                    <VideoPlayer key={selected.id} media={selected} />
                  )}
                  <View style={s.viewerToolbar}>
                    {selected.type === "IMAGE" && (
                      <View style={s.row}>
                        <Pressable
                          accessibilityRole="button"
                          style={s.close}
                          accessibilityLabel="Diminuir imagem"
                          onPress={() => setZoom((z) => Math.max(1, z - 0.5))}
                        >
                          <Icon name="remove-outline" />
                        </Pressable>
                        <Text style={s.subtle}>{Math.round(zoom * 100)}%</Text>
                        <Pressable
                          accessibilityRole="button"
                          style={s.close}
                          accessibilityLabel="Ampliar imagem"
                          onPress={() => setZoom((z) => Math.min(3, z + 0.5))}
                        >
                          <Icon name="add-outline" />
                        </Pressable>
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={favorites.includes(selected.id) ? "Remover dos favoritos" : "Salvar nos favoritos"}
                      accessibilityState={{ selected: favorites.includes(selected.id) }}
                      style={s.row}
                      onPress={() => favorite(selected)}
                    >
                      <Icon
                        name={
                          favorites.includes(selected.id)
                            ? "star"
                            : "star-outline"
                        }
                        color={pink}
                      />
                      <Text style={s.textLink}>
                        {favorites.includes(selected.id) ? "Salvo" : "Salvar"}
                      </Text>
                    </Pressable>
                  </View>
                  {selected.caption && (
                    <Text style={s.viewerCaption}>{selected.caption}</Text>
                  )}
                  {gallery.length > 1 && selected.type === "IMAGE" && (
                    <View style={s.pagination}>
                      <Button
                        secondary
                        label="Anterior"
                        disabled={galleryIndex <= 0}
                        onPress={() => galleryMove(-1)}
                      />
                      <Text style={s.subtle}>
                        {galleryIndex + 1} / {gallery.length}
                      </Text>
                      <Button
                        secondary
                        label="Próxima"
                        disabled={galleryIndex >= gallery.length - 1}
                        onPress={() => galleryMove(1)}
                      />
                    </View>
                  )}
                  {selected.topic_id && (
                    <View style={{ padding: 18 }}>
                      <Button
                        secondary
                        label="Ver conteúdo do posicionamento"
                        icon="reader-outline"
                        onPress={() => {
                          const topic = topics.find(
                            (t) => t.id === selected.topic_id,
                          );
                          setSelected(null);
                          if (topic) openTopic(topic);
                        }}
                      />
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
      <CenteredModal visible={authPrompt && !user} onClose={() => setAuthPrompt(false)}
        closeLabel="Fechar convite de cadastro" maxWidth={420} contentStyle={s.authPrompt}>
            <View style={s.authIcon}><Icon name="person-add-outline" color={pink} size={30} /></View>
            <Text style={s.authEyebrow}>UM NOVO OLHAR COMEÇA AQUI</Text>
            <Text style={s.authTitle}>Seu guia, sempre com você</Text>
            <Text style={s.authCopy}>Crie sua conta gratuita para explorar os conteúdos e salvar seus favoritos.</Text>
            <View style={{ alignSelf: "stretch", gap: 12 }}>
              <Button label="Criar minha conta gratuita" onPress={() => beginAuth(true)} />
              <Button label="Já tenho uma conta" secondary onPress={() => beginAuth(false)} />
            </View>
            <Text style={s.authFootnote}>Cadastro gratuito. O Premium é opcional.</Text>
      </CenteredModal>
      <CenteredModal
        visible={premium}
        onClose={() => setPremium(false)}
        closeLabel="Fechar Premium"
        contentStyle={s.premiumModal}
      >
            <View style={s.premiumIcon}>
              <Icon name="sparkles-outline" color={pink} size={36} />
            </View>
            <Text style={s.eyebrow}>DOMINANDO A MAMOGRAFIA PREMIUM</Text>
            <Text style={s.premiumTitle}>
              {settings.premium_title || "Aprofunde seu aprendizado"}
            </Text>
            <Text style={s.emptyCopy}>Todos os posicionamentos, imagens e vídeos para estudar com liberdade.</Text>
            <View style={s.premiumBenefit}>
              <Icon name="shield-checkmark-outline" color={pink} size={24} />
              <View style={{ flex: 1 }}>
                <Text style={s.premiumBenefitTitle}>Seu aprendizado, sem anúncios</Text>
                <Text style={s.subtle}>Mais foco em cada detalhe, com acesso completo.</Text>
              </View>
            </View>
            <Text style={s.subtle}>Pagamento único. Sem mensalidade ou renovação automática.</Text>
            {categories
              .filter((c) => c.access_type === "PREMIUM")
              .map((c) => (
                <View key={c.id} style={s.premiumFeature}>
                  <Icon name="checkmark-circle-outline" color={pink} />
                  <Text style={[s.subtle, { flex: 1 }]}>{c.name}</Text>
                </View>
              ))}
            {premium && user && <PremiumPayment user={user} onUser={setUser} onTrialStarted={onTrialStarted} onPaid={() => {
              setPremium(false);
              setRefresh((n) => n + 1);
              notify("Premium liberado! Bons estudos.");
            }} />}
            {!user && (
              <Button
                label="Entrar na minha conta"
                onPress={() => {
                  setPremium(false);
                  navigate("profile");
                }}
              />
            )}
            <Button
              secondary
              label="Continuar explorando"
              onPress={() => setPremium(false)}
            />
      </CenteredModal>
    </SafeAreaView>
    </PlayBillingProvider>
  );
}
export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans400: require("./assets/fonts/DMSans-400.ttf"),
    DMSans500: require("./assets/fonts/DMSans-500.ttf"),
    DMSans600: require("./assets/fonts/DMSans-600.ttf"),
    DMSans700: require("./assets/fonts/DMSans-700.ttf"),
    Manrope600: require("./assets/fonts/Manrope-600.ttf"),
    Manrope700: require("./assets/fonts/Manrope-700.ttf"),
    Manrope800: require("./assets/fonts/Manrope-800.ttf"),
  });
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={[s.safe, { alignItems: "center", justifyContent: "center" }]}
      >
        <NativeImage
          source={require("./assets/brand.png")}
          style={{ width: 235, height: 80 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={pink} style={{ marginTop: 24 }} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
