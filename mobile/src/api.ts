import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web"
    ? `${window.location.protocol}//${window.location.hostname}/app_mamografia/api/index.php`
    : __DEV__
      ? "http://10.0.2.2/app_mamografia/api/index.php"
      : "https://testes-techcode.shop/app_mamografia/api/index.php");
let token = "";
let onSessionExpired: (() => void) | undefined;
export function setSessionExpiredHandler(handler?: () => void) {
  onSessionExpired = handler;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function setToken(value: string) {
  token = value;
  if (Platform.OS === "web") {
    if (value) sessionStorage.setItem("mamografia_token", value);
    else sessionStorage.removeItem("mamografia_token");
  } else if (value) await SecureStore.setItemAsync("mamografia_token", value);
  else await SecureStore.deleteItemAsync("mamografia_token");
}
export async function restoreToken() {
  token =
    Platform.OS === "web"
      ? sessionStorage.getItem("mamografia_token") || ""
      : (await SecureStore.getItemAsync("mamografia_token")) || "";
  return token;
}
export async function api<T>(
  route: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const url = `${API_URL}?route=${encodeURIComponent(route.split("?")[0])}${route.includes("?") ? "&" + route.split("?")[1] : ""}`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, 20000);
  let response: Response;
  let data;
  try {
    response = await fetch(url, {
    method: options.method || "GET",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    try {
      data = await response.json();
      if (data === null || typeof data !== "object") throw new Error("Invalid JSON payload");
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ApiError(`O servidor retornou uma resposta inválida (HTTP ${response.status}). Tente novamente ou entre em contato com o suporte.`, response.status);
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new Error("O servidor demorou para responder. Tente novamente em outra rede ou mais tarde.");
    throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
  if (response.status === 401 && token && !route.startsWith("/auth/"))
    onSessionExpired?.();
  if (!response.ok)
    throw new ApiError(
      data.error || "Não foi possível carregar os dados.",
      response.status,
    );
  const localMediaUrl = (value: string | null) => {
    if (!value) return value;
    const source = new URL(value);
    const target = new URL(API_URL);
    if (source.hostname === "localhost" && target.hostname !== "localhost") {
      source.hostname = target.hostname;
      source.port = target.port;
    }
    return source.toString();
  };
  const normalize = (item: Record<string, unknown>) => {
    if (item.type !== "VIDEO_URL" && typeof item.url === "string")
      item.url = localMediaUrl(item.url);
    if (typeof item.thumbnail_url === "string")
      item.thumbnail_url = localMediaUrl(item.thumbnail_url);
    if (typeof item.logo_url === "string")
      item.logo_url = localMediaUrl(item.logo_url);
    if (typeof item.image_url === "string")
      item.image_url = localMediaUrl(item.image_url);
  };
  if (Array.isArray(data.data)) data.data.forEach(normalize);
  else if (data && typeof data === "object") normalize(data);
  if (Array.isArray(data.partners)) data.partners.forEach(normalize);
  if (Array.isArray(data.banners))
    data.banners.forEach((item: Record<string, unknown>) => {
      if (typeof item.logo_url === "string")
        item.logo_url = localMediaUrl(item.logo_url);
      if (typeof item.image_url === "string")
        item.image_url = localMediaUrl(item.image_url);
    });
  return data;
}
export interface Media {
  id: number;
  topic_id: number | null;
  type: "IMAGE" | "VIDEO_UPLOAD" | "VIDEO_URL";
  title: string;
  caption: string | null;
  alt_text: string | null;
  topic_title: string | null;
  category_name: string | null;
  category_id: number | null;
  access_type: "FREE" | "PREMIUM";
  locked: boolean;
  url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}
export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
  access_type: string;
  topic_count: number;
}
export interface Topic {
  id: number;
  title: string;
  category_id: number;
  category_name: string;
  access_type: string;
}
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_premium: number;
  premium_permanent?: boolean;
  trial_active?: boolean;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_days?: number;
  trial_available?: boolean;
}
export interface Content {
  id: number;
  topic_id: number;
  title: string;
  source_pages: string;
  blocks: ContentBlock[];
}
export interface ContentBlock {
  id: number;
  type: string;
  title: string | null;
  body: string;
  metadata: {
    source_pdf_sha256: string;
    source_pages: string;
    scope?: string;
    paragraphs: {
      kind: string;
      runs: { text: string; bold: boolean; italic: boolean }[];
      source_pages: string;
    }[];
  } | null;
}
export interface Page {
  data: Media[];
  total: number;
  page: number;
  pages: number;
}
