import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Film,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  LayoutGrid,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  Play,
  Eye,
  EyeOff,
  X,
  Handshake,
  BarChart3,
  Users,
  Settings2,
  BookOpen,
} from "lucide-react";
import Advertising from "./Advertising";
import Contents from "./Contents";
import { Dashboard, Clients, Settings } from "./Management";
import "./style.css";

type Topic = {
  id: number;
  title: string;
  category_name: string;
  category_id: number;
  access_type: string;
};
type Media = {
  id: number;
  topic_id: number | null;
  type: string;
  title: string;
  caption: string | null;
  alt_text: string | null;
  url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  size: number;
  order_position: number;
  access_type: string;
  status: number;
  topic_title: string | null;
  category_name: string | null;
  original_name: string | null;
};
type User = { id: number; name: string; email: string; role: string };
type Page = { data: Media[]; total: number; page: number; pages: number };
const env = (import.meta as unknown as { env: Record<string, string> }).env;
const API =
  env.VITE_API_URL ||
  `${location.protocol}//${location.hostname}/app_mamografia/api/index.php`;
const APP_PREVIEW = API.split("/api/")[0] + "/preview/";
let token = sessionStorage.getItem("mamografia_admin_token") || "";
async function request<T>(
  route: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(
    `${API}?route=${encodeURIComponent(route.split("?")[0])}${route.includes("?") ? "&" + route.split("?")[1] : ""}`,
    {
      method,
      headers: {
        ...(!multipart ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
const formatDuration = (value: number | null) =>
  value
    ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
    : "Vídeo";
const fileSize = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
function App() {
  const [section, setSection] = useState<
    "dashboard" | "clients" | "media" | "contents" | "advertising" | "settings"
  >("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("admin@mamografia.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [items, setItems] = useState<Media[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    images: 0,
    videos: 0,
    topics: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState<Media | null>(null);
  const [editing, setEditing] = useState<Media | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Media | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    caption: "",
    alt_text: "",
    topic_id: "",
    access_type: "PREMIUM",
    status: "1",
    order_position: "0",
    type: "UPLOAD",
    external_url: "",
  });
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    request<User>("/profile")
      .then((u) => {
        if (u.role === "ADMIN") setUser(u);
        else {
          token = "";
          sessionStorage.removeItem("mamografia_admin_token");
        }
      })
      .catch(() => {
        token = "";
        sessionStorage.removeItem("mamografia_admin_token");
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user || section !== "media") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "24", page: String(page) });
    if (type) params.set("type", type);
    if (query) params.set("q", query);
    if (category) params.set("category_id", category);
    Promise.all([
      request<Page>(`/admin/media?${params}`),
      request<Topic[]>("/topics"),
      request<typeof stats>("/stats"),
    ])
      .then(([p, t, st]) => {
        if (cancelled) return;
        setItems(p.data);
        setTotal(p.total);
        setPages(p.pages);
        setTopics(t);
        setStats(st);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, section, page, type, query, category, refresh]);
  useEffect(() => {
    if (preview || editing !== undefined || deleting) {
      document.body.style.overflow = "hidden";
      modalRef.current?.focus();
    } else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [preview, editing, deleting]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setPreview(null);
        setEditing(undefined);
        setDeleting(null);
      }
      if (e.key === "Tab" && modalRef.current) {
        const controls = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ),
        ).filter((el) => !(el as HTMLButtonElement).disabled);
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const result = await request<{ token: string; user: User }>(
        "/admin/login",
        "POST",
        { email, password },
      );
      token = result.token;
      sessionStorage.setItem("mamografia_admin_token", token);
      setUser(result.user);
      setPassword("");
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  }
  async function logout() {
    try {
      await request("/auth/logout", "POST");
      token = "";
      sessionStorage.removeItem("mamografia_admin_token");
      setUser(null);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  function openEditor(item: Media | null) {
    setEditing(item);
    setFile(null);
    setReplace(null);
    setFormError("");
    setForm({
      title: item?.title || "",
      caption: item?.caption || "",
      alt_text: item?.alt_text || "",
      topic_id: String(item?.topic_id || ""),
      access_type: item?.access_type || "PREMIUM",
      status: String(item?.status ?? 1),
      order_position: String(item?.order_position || 0),
      type: item?.type === "VIDEO_URL" ? "VIDEO_URL" : "UPLOAD",
      external_url: item?.type === "VIDEO_URL" ? item.url || "" : "",
    });
  }
  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      if (editing) {
        await request(`/admin/media/${editing.id}`, "PUT", form);
        if (replace) {
          const body = new FormData();
          body.append("file", replace);
          await request(`/admin/media/${editing.id}`, "POST", body);
        }
      } else if (form.type === "VIDEO_URL")
        await request("/admin/media", "POST", form);
      else {
        if (!file) throw new Error("Selecione um arquivo.");
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => body.append(k, v));
        body.append("file", file);
        await request("/admin/media", "POST", body);
      }
      setEditing(undefined);
      setRefresh((n) => n + 1);
      setToast(
        editing ? "Mídia atualizada." : "Mídia adicionada à biblioteca.",
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/admin/media/${deleting.id}`, "DELETE");
      setDeleting(null);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      setRefresh((n) => n + 1);
      setToast(
        "Mídia removida da biblioteca. O arquivo original foi preservado.",
      );
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item: Media) {
    try {
      await request(`/admin/media/${item.id}`, "PUT", {
        ...item,
        status: item.status ? 0 : 1,
        external_url: item.type === "VIDEO_URL" ? item.url : "",
      });
      setRefresh((n) => n + 1);
      setToast(item.status ? "Mídia desativada." : "Mídia ativada.");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  if (!ready)
    return (
      <div className="boot">
        <LoaderCircle className="spin" />
        Carregando painel...
      </div>
    );
  if (!user)
    return (
      <div className="login-page">
        <div className="login-intro">
          <img src="./brand.png" alt="Dominando a Mamografia" />
          <span className="eyebrow">CONHECIMENTO QUE TRANSFORMA</span>
          <h1>
            Seu conteúdo.
            <br />
            Novos olhares.
          </h1>
          <p>Organize os materiais que acompanham cada etapa do aprendizado.</p>
          <div className="login-stamp">
            <ShieldCheck size={20} />
            Área administrativa
          </div>
        </div>
        <form className="login-card" onSubmit={login}>
          <div className="icon-square">
            <LockKeyhole />
          </div>
          <h2>Bem-vindo de volta</h2>
          <p>Entre para cuidar da sua biblioteca.</p>
          <label>
            E-mail
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Senha
            <div className="password-field">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          {loginError && (
            <div className="error" role="alert">
              {loginError}
            </div>
          )}
          <button className="primary" disabled={loginBusy}>
            {loginBusy ? <LoaderCircle className="spin" size={17} /> : null}
            Entrar no painel
            <ArrowRight size={16} />
          </button>
          <span className="login-note">
            Dominando a Mamografia · Gestão de conteúdo
          </span>
        </form>
      </div>
    );
  const categories = [
    ...new Map(
      topics.map((t) => [
        t.category_id,
        { id: t.category_id, name: t.category_name },
      ]),
    ).values(),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img className="brand" src="./brand.png" alt="Dominando a Mamografia" />
        <div className="sidebar-rule" />
        <span className="side-eyebrow">GERENCIAR MEU APLICATIVO</span>
        <button
          className={section === "dashboard" ? "side-active" : "side-link"}
          onClick={() => setSection("dashboard")}
        >
          <BarChart3 size={19} />
          Visão geral{section === "dashboard" && <span className="nav-dot" />}
        </button>
        <button
          className={section === "clients" ? "side-active" : "side-link"}
          onClick={() => setSection("clients")}
        >
          <Users size={19} />
          Clientes{section === "clients" && <span className="nav-dot" />}
        </button>
        <button
          className={section === "media" ? "side-active" : "side-link"}
          onClick={() => setSection("media")}
        >
          <FolderOpen size={19} />
          Biblioteca de mídias
          {section === "media" && <span className="nav-dot" />}
        </button>
        <button
          className={section === "contents" ? "side-active" : "side-link"}
          onClick={() => setSection("contents")}
        >
          <BookOpen size={19} />
          Conteúdos do manual
          {section === "contents" && <span className="nav-dot" />}
        </button>
        <button
          className={section === "advertising" ? "side-active" : "side-link"}
          onClick={() => setSection("advertising")}
        >
          <Handshake size={19} />
          Parcerias e anúncios
          {section === "advertising" && <span className="nav-dot" />}
        </button>
        <a
          className="side-link"
          href={APP_PREVIEW}
          target="_blank"
          rel="noreferrer"
        >
          <LayoutGrid size={19} />
          Visualizar aplicativo
        </a>
        <button
          className={section === "settings" ? "side-active" : "side-link"}
          onClick={() => setSection("settings")}
        >
          <Settings2 size={19} />
          Configurações{section === "settings" && <span className="nav-dot" />}
        </button>
        <div className="sidebar-bottom">
          <div className="side-tip">
            <Sparkles size={22} />
            <strong>Conteúdo que evolui</strong>
            <p>
              Atualize a biblioteca. As mudanças aparecem no aplicativo sem uma
              nova versão.
            </p>
          </div>
          <div className="admin-user">
            <span className="avatar">AD</span>
            <div>
              <strong>{user.name}</strong>
              <small>Administrador</small>
            </div>
            <button className="icon-button" onClick={logout} title="Sair">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Administração <ChevronRight size={12} />
            <strong>
              {
                {
                  dashboard: "Visão geral",
                  clients: "Clientes",
                  media: "Mídias",
                  contents: "Conteúdos do manual",
                  advertising: "Anúncios",
                  settings: "Configurações",
                }[section]
              }
            </strong>
          </span>
          <div>
            <span className="live-dot" />
            Sua biblioteca, sempre atualizada
            <span className="avatar small">AD</span>
            <button
              className="icon-button mobile-logout"
              onClick={logout}
              aria-label="Sair do painel"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <nav className="admin-section-nav" aria-label="Seções do painel">
          <button
            className={section === "dashboard" ? "selected" : ""}
            onClick={() => setSection("dashboard")}
          >
            <BarChart3 size={16} />
            Visão geral
          </button>
          <button
            className={section === "clients" ? "selected" : ""}
            onClick={() => setSection("clients")}
          >
            <Users size={16} />
            Clientes
          </button>
          <button
            className={section === "media" ? "selected" : ""}
            onClick={() => setSection("media")}
          >
            <FolderOpen size={16} />
            Mídias
          </button>
          <button
            className={section === "contents" ? "selected" : ""}
            onClick={() => setSection("contents")}
          >
            <BookOpen size={16} />
            Conteúdos do manual
          </button>
          <button
            className={section === "advertising" ? "selected" : ""}
            onClick={() => setSection("advertising")}
          >
            <Handshake size={16} />
            Parcerias e anúncios
          </button>
          <button
            className={section === "settings" ? "selected" : ""}
            onClick={() => setSection("settings")}
          >
            <Settings2 size={16} />
            Configurações
          </button>
        </nav>
        <div className="page-content">
          {section === "dashboard" ? (
            <Dashboard api={request} notify={setToast} navigate={setSection} />
          ) : section === "clients" ? (
            <Clients api={request} notify={setToast} />
          ) : section === "settings" ? (
            <Settings
              api={request}
              notify={setToast}
              account={user}
              onAccount={setUser}
            />
          ) : section === "advertising" ? (
            <Advertising api={request} notify={setToast} />
          ) : section === "contents" ? (
            <Contents api={request} notify={setToast} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">ORGANIZE, PUBLIQUE E INSPIRE</span>
                  <h1>Biblioteca de mídias</h1>
                  <p>
                    Todos os vídeos e imagens do seu aplicativo, em um só lugar.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => openEditor(null)}
                  aria-label="Adicionar mídia"
                >
                  <Plus size={18} />
                  Adicionar mídia
                </button>
              </div>
              <div className="stats">
                {[
                  {
                    icon: Grid2X2,
                    value: stats.total,
                    label: "Mídias publicadas",
                  },
                  { icon: Video, value: stats.videos, label: "Vídeos" },
                  { icon: ImageIcon, value: stats.images, label: "Imagens" },
                  {
                    icon: FolderOpen,
                    value: stats.topics,
                    label: "Posicionamentos",
                  },
                ].map((st) => (
                  <div className="stat-card" key={st.label}>
                    <div className="stat-icon">
                      <st.icon size={21} />
                    </div>
                    <div>
                      <strong>{st.value}</strong>
                      <span>{st.label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <section className="library">
                <div className="library-toolbar">
                  <div className="tabs">
                    {[
                      { id: "", label: "Todas as mídias", icon: Grid2X2 },
                      { id: "VIDEO", label: "Vídeos", icon: Film },
                      { id: "IMAGE", label: "Imagens", icon: ImageIcon },
                    ].map((t) => (
                      <button
                        key={t.id}
                        className={type === t.id ? "selected" : ""}
                        aria-label={t.label}
                        aria-pressed={type === t.id}
                        onClick={() => {
                          setType(t.id);
                          setPage(1);
                        }}
                      >
                        <t.icon size={16} />
                        {t.id === "" ? (
                          <>
                            <span className="tab-label-desktop">{t.label}</span>
                            <span className="tab-label-mobile">Todas</span>
                          </>
                        ) : (
                          t.label
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="search">
                    <Search size={18} />
                    <input
                      aria-label="Buscar mídias"
                      placeholder="Buscar título ou posicionamento..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        className="icon-button"
                        aria-label="Limpar busca"
                        onClick={() => setSearch("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="library-filters">
                  <select
                    aria-label="Filtrar categoria"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="filter-summary">
                    {(search || category) && (
                      <button
                        className="clear-filter"
                        onClick={() => {
                          setSearch("");
                          setCategory("");
                          setPage(1);
                        }}
                      >
                        <X size={14} />
                        Limpar filtros
                      </button>
                    )}
                    <span>{total} arquivos na biblioteca</span>
                  </div>
                </div>
                {loading ? (
                  <div className="empty">
                    <LoaderCircle className="spin" />
                    Carregando mídias...
                  </div>
                ) : error ? (
                  <div className="empty">
                    <p className="error">{error}</p>
                    <button
                      className="secondary"
                      onClick={() => setRefresh((n) => n + 1)}
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="empty">
                    <Search size={32} />
                    <h3>Nenhuma mídia encontrada</h3>
                    <p>Experimente outro termo ou categoria.</p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setSearch("");
                        setCategory("");
                        setType("");
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                ) : (
                  <div className="media-grid">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        className={`media-card ${!item.status ? "inactive" : ""}`}
                      >
                        <button
                          className="card-image"
                          aria-label={`Visualizar ${item.title}`}
                          onClick={() => setPreview(item)}
                        >
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.alt_text || item.title}
                              loading="lazy"
                            />
                          ) : (
                            <div className="no-thumb">
                              {item.type === "IMAGE" ? (
                                <ImageIcon size={38} />
                              ) : (
                                <Film size={38} />
                              )}
                            </div>
                          )}
                          <span
                            className={`badge ${item.access_type === "PREMIUM" ? "premium" : ""}`}
                          >
                            {item.access_type === "PREMIUM" ? (
                              <LockKeyhole size={10} />
                            ) : (
                              <Check size={10} />
                            )}{" "}
                            {item.access_type === "PREMIUM"
                              ? "Premium"
                              : "Gratuito"}
                          </span>
                          <span className="file-kind">
                            {item.type === "IMAGE" ? (
                              <ImageIcon size={11} />
                            ) : (
                              <Film size={11} />
                            )}{" "}
                            {item.type === "IMAGE"
                              ? "Imagem"
                              : formatDuration(item.duration)}
                          </span>
                          {item.type !== "IMAGE" && (
                            <span className="play">
                              <Play
                                size={22}
                                fill="currentColor"
                                strokeWidth={1.5}
                              />
                            </span>
                          )}
                          {!item.status && (
                            <span className="inactive-badge">Desativada</span>
                          )}
                        </button>
                        <div className="card-content">
                          <span className="card-category">
                            {item.category_name || "Biblioteca geral"}
                          </span>
                          <h3 title={item.title}>{item.title}</h3>
                          <span className="file-info">
                            {item.type === "VIDEO_URL"
                              ? "Link externo"
                              : fileSize(item.size)}{" "}
                            ·{" "}
                            {item.type === "IMAGE"
                              ? "Imagem"
                              : item.type === "VIDEO_URL"
                                ? "URL externa"
                                : "MP4"}
                          </span>
                          <div className="card-actions">
                            <button
                              className={`status-toggle ${item.status ? "on" : ""}`}
                              onClick={() => toggle(item)}
                              aria-label={`${item.status ? "Desativar" : "Ativar"} ${item.title}`}
                              role="switch"
                              aria-checked={Boolean(item.status)}
                            >
                              <span />
                              {item.status ? "Ativa" : "Inativa"}
                            </button>
                            <div>
                              <button
                                className="icon-button"
                                onClick={() => openEditor(item)}
                                title="Editar mídia"
                                aria-label={`Editar ${item.title}`}
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                className="icon-button delete"
                                onClick={() => setDeleting(item)}
                                title="Remover mídia"
                                aria-label={`Remover ${item.title}`}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {!loading && pages > 1 && (
                  <div className="pagination">
                    <button
                      className="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ArrowLeft size={15} />
                      Anterior
                    </button>
                    <span>
                      Página {page} de {pages}
                    </span>
                    <button
                      className="secondary"
                      disabled={page >= pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          <footer>
            <ShieldCheck size={14} />
            Conteúdo do Manual de Posicionamentos · Dominando a Mamografia
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Fechar aviso">
            <X size={15} />
          </button>
        </div>
      )}
      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div
            ref={modalRef}
            className="modal preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar mídia"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{preview.category_name}</span>
                <h2>{preview.title}</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setPreview(null)}
                aria-label="Fechar mídia"
              >
                <X />
              </button>
            </div>
            {preview.type === "IMAGE" ? (
              <img
                className="full-image"
                src={preview.url!}
                alt={preview.alt_text || preview.title}
              />
            ) : preview.type === "VIDEO_URL" ? (
              <a
                className="primary"
                href={preview.url!}
                target="_blank"
                rel="noreferrer"
              >
                Abrir vídeo externo
                <ArrowRight size={15} />
              </a>
            ) : (
              <video
                className="full-video"
                src={preview.url!}
                controls
                preload="metadata"
                onError={() =>
                  setToast(
                    "Não foi possível reproduzir o vídeo. Feche e abra a mídia novamente.",
                  )
                }
              />
            )}
            <div className="preview-footer">
              <p>{preview.caption || preview.original_name}</p>
              <button
                className="secondary"
                onClick={() => {
                  const item = preview;
                  setPreview(null);
                  openEditor(item);
                }}
              >
                <Pencil size={14} />
                Editar informações
              </button>
            </div>
          </div>
        </div>
      )}
      {editing !== undefined && (
        <div className="overlay">
          <div
            ref={modalRef}
            className="modal editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Editar mídia" : "Adicionar mídia"}
            tabIndex={-1}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">SUA BIBLIOTECA</span>
                <h2>{editing ? "Editar mídia" : "Adicionar nova mídia"}</h2>
              </div>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => setEditing(undefined)}
                aria-label="Fechar editor"
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="form-body">
                {!editing && (
                  <div className="tabs">
                    <button
                      type="button"
                      className={form.type === "UPLOAD" ? "selected" : ""}
                      onClick={() => update("type", "UPLOAD")}
                    >
                      <UploadCloud size={16} />
                      Arquivo
                    </button>
                    <button
                      type="button"
                      className={form.type === "VIDEO_URL" ? "selected" : ""}
                      onClick={() => update("type", "VIDEO_URL")}
                    >
                      <Video size={16} />
                      URL externa
                    </button>
                  </div>
                )}
                {!editing && form.type === "UPLOAD" && (
                  <label className="upload-zone">
                    <UploadCloud size={30} />
                    <strong>
                      {file ? file.name : "Escolha uma imagem ou um vídeo"}
                    </strong>
                    <small>
                      JPG, PNG, WebP, MP4 ou WebM · até 40 MB por arquivo
                    </small>
                    <input
                      type="file"
                      className="visually-hidden"
                      aria-label="Selecionar arquivo de mídia"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setFile(f);
                        if (f && !form.title)
                          update("title", f.name.replace(/\.[^.]+$/, ""));
                      }}
                      required
                    />
                    <span className="secondary upload-trigger">
                      {file ? "Trocar arquivo" : "Selecionar arquivo"}
                    </span>
                  </label>
                )}
                {form.type === "VIDEO_URL" && (
                  <label>
                    URL do vídeo
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.external_url}
                      onChange={(e) => update("external_url", e.target.value)}
                      required
                    />
                  </label>
                )}
                <label>
                  Título
                  <input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                <label>
                  Posicionamento
                  <select
                    value={form.topic_id}
                    onChange={(e) => {
                      const t = topics.find(
                        (t) => String(t.id) === e.target.value,
                      );
                      setForm((f) => ({
                        ...f,
                        topic_id: e.target.value,
                        access_type: t?.access_type || f.access_type,
                      }));
                    }}
                  >
                    <option value="">Biblioteca geral (sem tópico)</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Legenda
                  <textarea
                    value={form.caption}
                    onChange={(e) => update("caption", e.target.value)}
                    rows={3}
                    maxLength={10000}
                  />
                </label>
                <label>
                  Texto alternativo
                  <input
                    value={form.alt_text}
                    onChange={(e) => update("alt_text", e.target.value)}
                    maxLength={255}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Acesso
                    <select
                      value={form.access_type}
                      onChange={(e) => update("access_type", e.target.value)}
                    >
                      <option value="FREE">Gratuito</option>
                      <option value="PREMIUM">Premium</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={form.status}
                      onChange={(e) => update("status", e.target.value)}
                    >
                      <option value="1">Ativa</option>
                      <option value="0">Desativada</option>
                    </select>
                  </label>
                  <label>
                    Ordem
                    <input
                      type="number"
                      min="0"
                      value={form.order_position}
                      onChange={(e) => update("order_position", e.target.value)}
                    />
                  </label>
                </div>
                {topics.find((t) => String(t.id) === form.topic_id)
                  ?.access_type === "PREMIUM" && (
                  <p className="form-note">
                    <LockKeyhole size={14} />O acesso Premium do tópico
                    prevalece sobre o acesso da mídia.
                  </p>
                )}
                {editing && form.type !== "VIDEO_URL" && (
                  <label>
                    Substituir arquivo (opcional)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={(e) => setReplace(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
                {formError && (
                  <div className="error" role="alert">
                    {formError}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(undefined)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}{" "}
                  {busy ? "Salvando..." : "Salvar mídia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleting && (
        <div className="overlay">
          <div
            ref={modalRef}
            className="modal delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar remoção"
            tabIndex={-1}
          >
            <div className="icon-square">
              <Trash2 />
            </div>
            <h2>Remover esta mídia?</h2>
            <p>
              <strong>{deleting.title}</strong>
            </p>
            <p>
              Ela deixará de aparecer no aplicativo. O arquivo original será
              preservado para revisão.
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy} onClick={remove}>
                {busy ? "Removendo..." : "Remover mídia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
