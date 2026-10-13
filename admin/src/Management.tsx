import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  FolderOpen,
  Globe2,
  KeyRound,
  LoaderCircle,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import "./management.css";

type Request = <T>(
  route: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
type Props = { api: Request; notify: (message: string) => void };
type Client = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_premium: number;
  status: number;
  created_at: string;
  premium_since?: string;
  trial_active?: boolean;
  trial_ends_at?: string | null;
  last_login: string | null;
  favorites_count?: number;
  sessions_count?: number;
  favorites?: { id: number; title: string }[];
  history?: { action: string; created_at: string; actor_name: string }[];
};
type DashboardData = {
  days: number;
  since: string;
  customers: {
    total: number;
    active: number;
    blocked: number;
    premium: number;
  };
  new: number;
  catalog: { total: number; images: number; videos: number };
  promotions: { partners: number; campaigns: number };
  traffic: { views: number; visitors: number };
  daily: { day: string; views: number; visitors: number }[];
  popular: { screen: string; views: number }[];
  devices: { device: string; views: number }[];
  activity: {
    id: number;
    action: string;
    actor_name: string;
    created_at: string;
  }[];
  analytics_ready: boolean;
  analytics_enabled: boolean;
};
const number = (value: number | undefined) =>
  Number(value || 0).toLocaleString("pt-BR");
const date = (value?: string | null) =>
  value ? new Date(value.replace(" ", "T")).toLocaleDateString("pt-BR") : "—";
const screens: Record<string, string> = {
  home: "Página inicial",
  media: "Biblioteca de mídias",
  favorites: "Favoritos",
  profile: "Perfil e conta",
  topic: "Conteúdo e posicionamentos",
  category: "Categorias",
  partners: "Parceiros",
};
const actions: Record<string, string> = {
  CLIENT_CREATED: "Cliente cadastrado",
  CLIENT_UPDATED: "Dados do cliente atualizados",
  CLIENT_PASSWORD_CHANGED: "Senha do cliente redefinida",
  PREMIUM_GRANTED: "Acesso Premium liberado",
  PREMIUM_REVOKED: "Acesso Premium retirado",
  PREMIUM_TRIAL_STARTED: "Período de teste iniciado",
  CLIENT_BLOCKED: "Conta do cliente bloqueada",
  CLIENT_ACTIVATED: "Conta do cliente reativada",
  SITE_SETTINGS_UPDATED: "Configurações do site atualizadas",
  ADMIN_PASSWORD_CHANGED: "Senha administrativa alterada",
  ADMIN_ACCOUNT_UPDATED: "Conta administrativa atualizada",
  AUTH_LOGIN: "Entrada na conta",
  AUTH_REGISTER: "Conta criada",
  MEDIA_CREATED: "Mídia adicionada",
  CONTENT_UPDATED: "Texto do manual atualizado",
  GOOGLE_PLAY_PURCHASE: "Compra Google Play atualizada",
  GOOGLE_PLAY_VOIDED: "Compra Google Play estornada",
  MEDIA_ARCHIVED: "Mídia arquivada",
  ADVERTISING_UPDATED: "Publicidade atualizada",
  PARTNER_CREATED: "Parceiro cadastrado",
  BANNER_CREATED: "Campanha cadastrada",
};
function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error" role="alert">
      {message}
      {retry && (
        <button className="secondary" onClick={retry}>
          <RefreshCw size={16} />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
function Loading() {
  return (
    <div className="management-loading" role="status">
      <LoaderCircle className="spin" />
      Carregando informações...
    </div>
  );
}
export function Dashboard({
  api,
  navigate,
}: Props & {
  navigate: (section: "clients" | "media" | "advertising" | "settings") => void;
}) {
  const [days, setDays] = useState(30),
    [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<DashboardData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api<DashboardData>(`/admin/dashboard?days=${days}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, days, refresh]);
  const daily = data
    ? Array.from({ length: days }, (_, i) => {
        const day = new Date(`${data.since}T00:00:00Z`);
        day.setUTCDate(day.getUTCDate() + i);
        const key = day.toISOString().slice(0, 10);
        return (
          data.daily.find((d) => d.day === key) || {
            day: key,
            views: 0,
            visitors: 0,
          }
        );
      })
    : [];
  const max = Math.max(1, ...daily.map((d) => Number(d.views)));
  return (
    <div className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACOMPANHE CADA NOVO OLHAR</span>
          <h1>Visão geral</h1>
          <p>Seu público, seu conteúdo e os próximos passos do seu negócio.</p>
        </div>
        <div className="heading-tools">
          <select
            aria-label="Período das métricas"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button
            className="icon-button bordered"
            aria-label="Atualizar métricas"
            onClick={() => setRefresh((v) => v + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
      {error ? (
        <Failure message={error} retry={() => setRefresh((v) => v + 1)} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="overview-hero">
            <div>
              <span className="hero-label">
                <Activity size={15} />
                SEU ESPAÇO DE GESTÃO
              </span>
              <h2>
                Conhecimento que alcança.
                <br />
                Gestão que acompanha.
              </h2>
              <p>
                {number(data.customers.total)} clientes cadastrados e{" "}
                {number(data.catalog.total)} mídias publicadas para apoiar o
                aprendizado.
              </p>
              <button onClick={() => navigate("clients")}>
                Cuidar dos meus clientes
                <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="hero-orbit" aria-hidden="true">
              <Users size={42} />
              <span>Mais perto do seu público</span>
            </div>
          </div>
          <div className="metric-grid">
            {[
              {
                icon: Eye,
                value: data.traffic.views,
                title: "Páginas vistas",
                note: "Navegações no site no período",
                tone: "rose",
              },
              {
                icon: Globe2,
                value: data.traffic.visitors,
                title: "Visitantes",
                note: "Navegadores distintos no período",
                tone: "blue",
              },
              {
                icon: Users,
                value: data.new,
                title: "Novos clientes",
                note: "Cadastros realizados no período",
                tone: "green",
              },
              {
                icon: Crown,
                value: data.customers.premium,
                title: "Clientes Premium",
                note: "Contas ativas com acesso liberado",
                tone: "gold",
              },
            ].map((m) => (
              <div className={`metric-card ${m.tone}`} key={m.title}>
                <div className="metric-top">
                  <span>{m.title}</span>
                  <m.icon size={20} />
                </div>
                <strong>{number(m.value)}</strong>
                <small>{m.note}</small>
              </div>
            ))}
          </div>
          {(!data.analytics_ready || !data.analytics_enabled) && (
            <div className="management-note">
              <BarChart3 size={20} />
              <span>
                {!data.analytics_ready
                  ? "Para começar a registrar visitas na hospedagem, importe database/management.sql no banco. Os demais dados do painel já estão disponíveis."
                  : "O registro de visitas está pausado nas configurações. O histórico existente continua disponível."}
              </span>
            </div>
          )}
          <div className="dashboard-columns">
            <section className="management-card">
              <div className="card-heading">
                <div>
                  <h2>Movimento do site</h2>
                  <p>Visualizações por dia · horário UTC</p>
                </div>
                <span className="pill">
                  <span className="live-dot" />
                  Dados reais
                </span>
              </div>
              <div
                className="traffic-chart"
                role="group"
                aria-label="Visualizações diárias"
              >
                {daily.map((d, i) => (
                  <div className="chart-column" key={d.day}>
                    <div className="chart-track">
                      <div
                        tabIndex={0}
                        className="chart-bar"
                        style={{
                          height: `${Number(d.views) ? Math.max(4, (Number(d.views) / max) * 100) : 1}%`,
                        }}
                        aria-label={`${date(d.day)}: ${number(d.views)} visualizações, ${number(d.visitors)} visitantes`}
                      >
                        <span className="chart-tooltip">
                          {date(d.day)}
                          <strong>{number(d.views)} visualizações</strong>
                          {number(d.visitors)} visitantes
                        </span>
                      </div>
                    </div>
                    <small>
                      {i % Math.ceil(days / 7) === 0
                        ? d.day.slice(8) + "/" + d.day.slice(5, 7)
                        : ""}
                    </small>
                  </div>
                ))}
              </div>
              {!Number(data.traffic.views) && (
                <p className="chart-empty">
                  As visitas aparecerão aqui conforme as pessoas navegarem pelo
                  site.
                </p>
              )}
            </section>
            <section className="management-card">
              <div className="card-heading">
                <div>
                  <h2>Páginas mais visitadas</h2>
                  <p>Onde seu público está aprendendo</p>
                </div>
                <ArrowUpRight size={20} />
              </div>
              {data.popular.length ? (
                data.popular.map((p, i) => (
                  <div className="popular-row" key={p.screen}>
                    <span className="rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{screens[p.screen] || p.screen}</strong>
                      <div className="progress-track">
                        <i
                          style={{
                            width: `${(Number(p.views) / Number(data.popular[0].views)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <b>{number(p.views)}</b>
                  </div>
                ))
              ) : (
                <div className="subtle-empty">
                  <Globe2 size={30} />
                  <p>Aguardando as primeiras visitas.</p>
                </div>
              )}
              <div className="device-summary">
                {["mobile", "desktop"].map((device) => (
                  <span key={device}>
                    {device === "mobile" ? "Celular" : "Computador"}
                    <strong>
                      {number(
                        data.devices.find((d) => d.device === device)?.views,
                      )}{" "}
                      páginas
                    </strong>
                  </span>
                ))}
              </div>
            </section>
          </div>
          <div className="dashboard-columns">
            <section className="management-card">
              <div className="card-heading">
                <div>
                  <h2>Seu negócio em números</h2>
                  <p>Estado atual, independente do período</p>
                </div>
                <ShieldCheck size={20} />
              </div>
              <div className="business-grid">
                {[
                  {
                    label: "Clientes ativos",
                    value: data.customers.active,
                    icon: Users,
                    section: "clients",
                  },
                  {
                    label: "Mídias publicadas",
                    value: data.catalog.total,
                    icon: FolderOpen,
                    section: "media",
                  },
                  {
                    label: "Parceiros ativos",
                    value: data.promotions.partners,
                    icon: ShieldCheck,
                    section: "advertising",
                  },
                  {
                    label: "Campanhas no ar",
                    value: data.promotions.campaigns,
                    icon: Megaphone,
                    section: "advertising",
                  },
                ].map((m) => (
                  <button
                    key={m.label}
                    onClick={() =>
                      navigate(m.section as "clients" | "media" | "advertising")
                    }
                  >
                    <m.icon size={19} />
                    <span>
                      <strong>{number(m.value)}</strong>
                      {m.label}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
              </div>
            </section>
            <section className="management-card">
              <div className="card-heading">
                <div>
                  <h2>Últimas atividades</h2>
                  <p>Ações realizadas pela administração</p>
                </div>
                <Activity size={20} />
              </div>
              {data.activity.length ? (
                <div className="activity-list">
                  {data.activity.map((a) => (
                    <div key={a.id}>
                      <span className="activity-mark">
                        <Check size={12} />
                      </span>
                      <p>
                        <strong>
                          {actions[a.action] ||
                            "Cadastro de publicidade atualizado"}
                        </strong>
                        <small>
                          {a.actor_name || "Administração"} ·{" "}
                          {date(a.created_at)}
                        </small>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="subtle-empty">
                  As próximas alterações aparecerão aqui.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export function Clients({ api, notify }: Props) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [access, setAccess] = useState(""),
    [status, setStatus] = useState(""),
    [role, setRole] = useState("USER");
  const [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0),
    [result, setResult] = useState<{
      data: Client[];
      total: number;
      pages: number;
    } | null>(null),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<number | "new" | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    const params = new URLSearchParams({
      q: query,
      access,
      status,
      role,
      page: String(page),
    });
    api<typeof result>(`/admin/users?${params}`)
      .then((r) => {
        if (active) setResult(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, query, access, status, role, page, refresh]);
  if (selected !== null)
    return (
      <ClientDetail
        key={selected}
        api={api}
        notify={notify}
        id={selected}
        back={() => {
          setSelected(null);
          setRefresh((v) => v + 1);
        }}
      />
    );
  return (
    <div className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RELACIONAMENTO E ACESSO</span>
          <h1>Clientes</h1>
          <p>Conheça seu público e cuide de cada conta com atenção.</p>
        </div>
        <button className="primary" onClick={() => setSelected("new")}>
          <Plus size={18} />
          Cadastrar cliente
        </button>
      </div>
      <div className="client-intro">
        <span className="intro-icon">
          <Users size={26} />
        </span>
        <div>
          <h2>Seu público, em um só lugar</h2>
          <p>
            Abra uma ficha para editar dados, redefinir a senha e gerenciar o
            Premium.
          </p>
        </div>
        <span className="pill">
          {result ? number(result.total) : "…"}{" "}
          {role === "ADMIN" ? "administradores" : "contas encontradas"}
        </span>
      </div>
      <section className="management-card client-directory">
        <div className="client-filters">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Buscar clientes"
              placeholder="Buscar nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Limpar busca de clientes"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
          <select
            aria-label="Filtrar acesso do cliente"
            value={access}
            onChange={(e) => {
              setAccess(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os acessos</option>
            <option value="FREE">Gratuito</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <select
            aria-label="Filtrar situação do cliente"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as situações</option>
            <option value="1">Ativo</option>
            <option value="0">Bloqueado</option>
          </select>
          <select
            aria-label="Filtrar perfil da conta"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="USER">Clientes</option>
            <option value="ALL">Todas as contas</option>
            <option value="ADMIN">Administradores</option>
          </select>
        </div>
        {error ? (
          <Failure message={error} retry={() => setRefresh((v) => v + 1)} />
        ) : !result ? (
          <Loading />
        ) : !result.data.length ? (
          <div className="subtle-empty">
            <Users size={34} />
            <h2>Nenhuma conta encontrada</h2>
            <p>
              {search || access || status
                ? "Ajuste os filtros para buscar novamente."
                : "Os clientes aparecerão aqui quando criarem uma conta."}
            </p>
            {(search || access || status) && (
              <button
                className="secondary"
                onClick={() => {
                  setSearch("");
                  setAccess("");
                  setStatus("");
                  setPage(1);
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="client-table-heading">
              <span>Cliente</span>
              <span>Acesso</span>
              <span>Situação</span>
              <span>Cadastro</span>
              <span />
            </div>
            <div className="client-rows">
              {result.data.map((c) => (
                <button
                  className="client-row"
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  aria-label={`Ver cliente ${c.name}`}
                >
                  <div className="client-identity">
                    <span className="client-avatar">
                      {c.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.email}</small>
                    </div>
                  </div>
                  <span
                    className={`access-pill ${c.role === "ADMIN" || Number(c.is_premium) ? "premium" : ""}`}
                  >
                    {c.role === "ADMIN" ? (
                      <ShieldCheck size={13} />
                    ) : Number(c.is_premium) ? (
                      <Crown size={13} />
                    ) : null}
                    {c.role === "ADMIN"
                      ? "Administrador"
                      : Number(c.is_premium)
                        ? "Premium"
                        : "Gratuito"}
                  </span>
                  <span
                    className={`status-pill ${Number(c.status) ? "active" : "blocked"}`}
                  >
                    <i />
                    {Number(c.status) ? "Ativo" : "Bloqueado"}
                  </span>
                  <span className="client-date">{date(c.created_at)}</span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
            <div className="pagination">
              <span>
                {number(result.total)} contas · Página {page} de{" "}
                {Math.max(1, result.pages)}
              </span>
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Anterior
              </button>
              <button
                className="secondary"
                disabled={page >= result.pages}
                onClick={() => setPage((v) => v + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function NewPassword({
  value,
  setValue,
  confirm,
  setConfirm,
}: {
  value: string;
  setValue: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="settings-fields">
      <label>
        Nova senha
        <div className="password-field">
          <input
            aria-label="Nova senha"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? "Ocultar nova senha" : "Mostrar nova senha"}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <small>Use pelo menos 8 caracteres.</small>
      </label>
      <label>
        Confirmar nova senha
        <input
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </label>
    </div>
  );
}
function ClientDetail({
  api,
  notify,
  id,
  back,
}: Props & { id: number | "new"; back: () => void }) {
  const [client, setClient] = useState<Client | null>(null),
    [form, setForm] = useState({
      name: "",
      email: "",
      is_premium: 0,
      status: 1,
    });
  const [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [passwordError, setPasswordError] = useState("");
  useEffect(() => {
    if (id === "new") return;
    let active = true;
    setLoadError("");
    api<Client>(`/admin/users/${id}`)
      .then((c) => {
        if (active) {
          setClient(c);
          setForm({
            name: c.name,
            email: c.email,
            is_premium: Number(c.is_premium),
            status: Number(c.status),
          });
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, id, refresh]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (id === "new" && password !== confirm) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      await api(
        id === "new" ? "/admin/users" : `/admin/users/${id}`,
        id === "new" ? "POST" : "PUT",
        { ...form, ...(id === "new" ? { password } : {}) },
      );
      notify(
        id === "new"
          ? "Cliente cadastrado."
          : "Dados e acesso do cliente atualizados.",
      );
      if (id === "new") back();
      else setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (password !== confirm) {
      setPasswordError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/users/${id}/password`, "PUT", { password });
      setPassword("");
      setConfirm("");
      notify(
        "Senha redefinida. As sessões anteriores do cliente foram encerradas.",
      );
      setRefresh((v) => v + 1);
    } catch (e) {
      setPasswordError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const readOnly = client?.role === "ADMIN";
  return (
    <div className="management-page">
      <button className="text-button" onClick={back} disabled={busy}>
        <ArrowLeft size={17} />
        Voltar aos clientes
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {id === "new" ? "NOVO RELACIONAMENTO" : `FICHA #${id}`}
          </span>
          <h1>
            {id === "new"
              ? "Cadastrar cliente"
              : client?.name || "Ficha do cliente"}
          </h1>
          <p>
            {id === "new"
              ? "Crie a conta e defina o acesso inicial."
              : "Gerencie os dados, o acesso e a segurança desta conta."}
          </p>
        </div>
        {client && (
          <span
            className={`access-pill ${readOnly || client.is_premium ? "premium" : ""}`}
          >
            {readOnly
              ? "Administrador"
              : client.is_premium
                ? "Premium"
                : "Gratuito"}
          </span>
        )}
      </div>
      {loadError ? (
        <Failure message={loadError} retry={() => setRefresh((v) => v + 1)} />
      ) : id !== "new" && !client ? (
        <Loading />
      ) : (
        <>
          {readOnly && (
            <div className="management-note">
              <ShieldCheck size={20} />
              <span>
                Conta administrativa. Edite seu próprio administrador em
                Configurações → Minha conta.
              </span>
            </div>
          )}
          <div className="detail-columns">
            <div>
              <form className="management-card" onSubmit={save}>
                <div className="card-heading">
                  <div>
                    <h2>Dados e acesso</h2>
                    <p>Informações da conta e permissão de uso</p>
                  </div>
                  <Users size={22} />
                </div>
                <fieldset
                  disabled={busy || readOnly}
                  className="settings-fields"
                >
                  <label>
                    Nome completo
                    <input
                      value={form.name}
                      maxLength={120}
                      required
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    E-mail do cliente
                    <input
                      value={form.email}
                      type="email"
                      maxLength={190}
                      required
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      autoComplete="email"
                    />
                  </label>
                  <div className="access-choice">
                    <div>
                      <Crown size={23} />
                      <strong>Acesso Premium</strong>
                      <p>
                        Libera todas as mídias e conteúdos Premium. Esta
                        alteração não realiza cobrança.
                      </p>
                    </div>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={Boolean(form.is_premium)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            is_premium: e.target.checked ? 1 : 0,
                          })
                        }
                      />
                      <span>
                        {form.is_premium
                          ? "Premium liberado"
                          : "Acesso gratuito"}
                      </span>
                    </label>
                  </div>
                  {id !== "new" && (
                    <label>
                      Situação da conta
                      <select
                        aria-label="Situação da conta"
                        value={form.status}
                        onChange={(e) =>
                          setForm({ ...form, status: Number(e.target.value) })
                        }
                      >
                        <option value={1}>Ativo — pode entrar e estudar</option>
                        <option value={0}>Bloqueado — acesso suspenso</option>
                      </select>
                      <small>
                        Bloquear encerra as sessões do cliente. Alterar o e-mail
                        também exige uma nova entrada.
                      </small>
                    </label>
                  )}
                  {id === "new" && (
                    <NewPassword
                      value={password}
                      setValue={setPassword}
                      confirm={confirm}
                      setConfirm={setConfirm}
                    />
                  )}
                </fieldset>
                {error && <Failure message={error} />}
                {!readOnly && (
                  <div className="settings-actions">
                    <button className="primary" disabled={busy}>
                      {busy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Save size={17} />
                      )}
                      {id === "new"
                        ? "Criar conta do cliente"
                        : "Salvar dados e acesso"}
                    </button>
                  </div>
                )}
              </form>
              {id !== "new" && !readOnly && (
                <form
                  className="management-card password-card"
                  onSubmit={changePassword}
                >
                  <div className="card-heading">
                    <div>
                      <h2>Redefinir senha</h2>
                      <p>Defina uma nova senha para este cliente.</p>
                    </div>
                    <KeyRound size={22} />
                  </div>
                  <fieldset disabled={busy}>
                    <NewPassword
                      value={password}
                      setValue={setPassword}
                      confirm={confirm}
                      setConfirm={setConfirm}
                    />
                  </fieldset>
                  <p className="field-help">
                    A senha atual não é solicitada. Ao salvar, as sessões
                    existentes serão encerradas. Informe a nova senha ao cliente
                    pelo seu canal de atendimento.
                  </p>
                  {passwordError && <Failure message={passwordError} />}
                  <div className="settings-actions">
                    <button className="primary" disabled={busy}>
                      <KeyRound size={17} />
                      Salvar nova senha
                    </button>
                  </div>
                </form>
              )}
            </div>
            <aside className="client-aside">
              <section className="management-card">
                <div className="card-heading">
                  <h2>Sobre esta conta</h2>
                  <ShieldCheck size={20} />
                </div>
                {client ? (
                  <dl className="account-facts">
                    <div>
                      <dt>Cadastro</dt>
                      <dd>{date(client.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Última entrada registrada</dt>
                      <dd>{date(client.last_login)}</dd>
                    </div>
                    <div>
                      <dt>Premium desde</dt>
                      <dd>{date(client.premium_since)}</dd>
                    </div>
                    {client.trial_ends_at && <div>
                      <dt>Teste até</dt>
                      <dd>{date(client.trial_ends_at)} · {client.trial_active ? "Em andamento" : "Encerrado"}</dd>
                    </div>}
                    <div>
                      <dt>Favoritos</dt>
                      <dd>{number(client.favorites_count)}</dd>
                    </div>
                    <div>
                      <dt>Sessões válidas</dt>
                      <dd>{number(client.sessions_count)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="field-help">
                    O histórico da conta estará disponível após o cadastro.
                  </p>
                )}
              </section>
              {client && (
                <>
                  <section className="management-card">
                    <div className="card-heading">
                      <h2>Últimos favoritos</h2>
                      <FolderOpen size={20} />
                    </div>
                    {client.favorites?.length ? (
                      client.favorites.map((f) => (
                        <div className="favorite-line" key={f.id}>
                          <FolderOpen size={15} />
                          <span>{f.title}</span>
                        </div>
                      ))
                    ) : (
                      <p className="field-help">
                        Este cliente ainda não salvou favoritos.
                      </p>
                    )}
                  </section>
                  <section className="management-card">
                    <div className="card-heading">
                      <h2>Histórico da conta</h2>
                      <CalendarDays size={20} />
                    </div>
                    <div className="activity-list">
                      {client.history?.length ? (
                        client.history.map((h, i) => (
                          <div key={i}>
                            <span className="activity-mark">
                              <Check size={12} />
                            </span>
                            <p>
                              <strong>
                                {actions[h.action] || "Conta atualizada"}
                              </strong>
                              <small>
                                {h.actor_name || "Conta"} · {date(h.created_at)}
                              </small>
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="field-help">
                          As próximas atividades serão registradas aqui.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

type Site = {
  app_name: string;
  footer_notice: string;
  premium_title: string;
  premium_description: string;
  premium_price_cents: string;
  premium_purchase_type: "ONE_TIME";
  premium_trial_days: string;
  support_email: string;
  privacy_url: string;
  terms_url: string;
  analytics_enabled: string;
};
type Account = { id: number; name: string; email: string; role: string };
export function Settings({
  api,
  notify,
  account,
  onAccount,
}: Props & { account: Account; onAccount: (u: Account) => void }) {
  const [tab, setTab] = useState("site"),
    [site, setSite] = useState<Site | null>(null),
    [form, setForm] = useState({ name: account.name, email: account.email });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    api<Site>("/admin/settings")
      .then((s) => {
        if (active) {
          setSite(s);
          setPremiumPrice((Number(s.premium_price_cents) / 100).toFixed(2).replace(".", ","));
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api, refresh]);
  async function saveSite(e: React.FormEvent) {
    e.preventDefault();
    const normalizedPrice = premiumPrice.trim().replace(",", ".");
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalizedPrice)) {
      setError("Informe o preço em reais, por exemplo 99,90.");
      return;
    }
    const [reais, centavos = ""] = normalizedPrice.split(".");
    const priceCents = Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
    if (priceCents > 100000000 || (priceCents > 0 && priceCents < 100)) {
      setError("Informe um preço a partir de R$ 1,00, ou zero para deixar a compra indisponível.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await api<Site>("/admin/settings", "PUT", {
        ...site,
        premium_price_cents: String(priceCents),
        premium_purchase_type: "ONE_TIME",
      });
      setSite(saved);
      setPremiumPrice((Number(saved.premium_price_cents) / 100).toFixed(2).replace(".", ","));
      notify("Configurações do site salvas.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAccount(e: React.FormEvent, security = false) {
    e.preventDefault();
    setError("");
    if (security && password !== confirm) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      const saved = await api<Account>("/admin/account", "PUT", {
        ...form,
        ...(security ? { password } : {}),
      });
      onAccount(saved);
      setPassword("");
      setConfirm("");
      notify(
        security
          ? "Sua senha foi alterada. Outras sessões administrativas foram encerradas."
          : "Sua conta foi atualizada.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO, COM CUIDADO</span>
          <h1>Configurações</h1>
          <p>Textos do aplicativo, preço do Premium e sua conta administrativa.</p>
        </div>
        <span className="intro-icon">
          <Settings2 size={27} />
        </span>
      </div>
      <div
        className="management-tabs"
        role="tablist"
        aria-label="Configurações"
      >
        <button
          role="tab"
          aria-selected={tab === "site"}
          className={tab === "site" ? "selected" : ""}
          onClick={() => {
            setTab("site");
            setError("");
          }}
          disabled={busy}
        >
          <Globe2 size={18} />
          Site e aplicativo
        </button>
        <button
          role="tab"
          aria-selected={tab === "account"}
          className={tab === "account" ? "selected" : ""}
          onClick={() => {
            setTab("account");
            setError("");
          }}
          disabled={busy}
        >
          <ShieldCheck size={18} />
          Minha conta
        </button>
      </div>
      {error && (
        <Failure
          message={error}
          retry={!site ? () => setRefresh((v) => v + 1) : undefined}
        />
      )}
      {tab === "site" ? (
        !site ? (
          !error && <Loading />
        ) : (
          <form onSubmit={saveSite} className="settings-layout">
            <div>
              <section className="management-card">
                <div className="card-heading">
                  <div>
                    <h2>Identidade e conteúdo</h2>
                    <p>Textos exibidos no site e no aplicativo</p>
                  </div>
                  <Globe2 size={22} />
                </div>
                <fieldset className="settings-fields" disabled={busy}>
                  <label>
                    Nome do aplicativo
                    <input
                      required
                      maxLength={120}
                      value={site.app_name}
                      onChange={(e) =>
                        setSite({ ...site, app_name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Aviso educacional no rodapé
                    <textarea
                      required
                      rows={5}
                      maxLength={4000}
                      value={site.footer_notice}
                      onChange={(e) =>
                        setSite({ ...site, footer_notice: e.target.value })
                      }
                    />
                  </label>
                  <div className="management-divider" />
                  <label>
                    Título do Premium
                    <input
                      maxLength={190}
                      value={site.premium_title}
                      onChange={(e) =>
                        setSite({ ...site, premium_title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Descrição do Premium
                    <textarea
                      rows={4}
                      maxLength={4000}
                      value={site.premium_description}
                      onChange={(e) =>
                        setSite({
                          ...site,
                          premium_description: e.target.value,
                        })
                      }
                    />
                  </label>
                </fieldset>
              </section>
              <section className="management-card">
                <div className="card-heading">
                  <div>
                    <h2>Plano Premium</h2>
                    <p>Um único plano, com pagamento único na web</p>
                  </div>
                  <ShieldCheck size={22} />
                </div>
                <fieldset className="settings-fields" disabled={busy}>
                  <p className="field-help">Sem mensalidade ou renovação automática. O acesso é liberado após a confirmação do pagamento.</p>
                  <label>
                    Preço do Premium (R$)
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      maxLength={10}
                      placeholder="99,90"
                      value={premiumPrice}
                      aria-describedby="premium-price-help"
                      onChange={(e) => setPremiumPrice(e.target.value)}
                    />
                  </label>
                  <p id="premium-price-help" className="field-help">Informe o valor em reais. Zero deixa a compra indisponível. O novo preço vale para os próximos checkouts; pagamentos já abertos mantêm o valor original.</p>
                  <p className="field-help">Na web, este preço é usado pelo Asaas. No app Android, o preço do Premium é configurado na Google Play Console.</p>
                  <div className="management-divider" />
                  <label>
                    Período de teste (dias)
                    <input
                      type="number"
                      min={0}
                      max={365}
                      step={1}
                      required
                      value={site.premium_trial_days}
                      aria-describedby="premium-trial-help"
                      onChange={(e) => setSite({ ...site, premium_trial_days: e.target.value })}
                    />
                  </label>
                  <p id="premium-trial-help" className="field-help">De 0 a 365 dias. Zero desativa novas ativações. O cliente começa o teste ao tocar em “Iniciar teste”, no app ou na web, uma única vez por conta. Alterações valem para próximas ativações; testes já iniciados mantêm sua data de término. Ao terminar, o cliente pode comprar o acesso definitivo, sem cobrança automática.</p>
                </fieldset>
              </section>
              <section className="management-card">
                <div className="card-heading">
                  <div>
                    <h2>Atendimento e documentos</h2>
                    <p>Links disponíveis no rodapé do aplicativo</p>
                  </div>
                  <Mail size={22} />
                </div>
                <fieldset className="settings-fields" disabled={busy}>
                  <label>
                    E-mail de suporte
                    <input
                      type="email"
                      maxLength={190}
                      value={site.support_email}
                      placeholder="atendimento@seudominio.com"
                      onChange={(e) =>
                        setSite({ ...site, support_email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Link da política de privacidade
                    <input
                      type="url"
                      value={site.privacy_url}
                      placeholder="https://..."
                      onChange={(e) =>
                        setSite({ ...site, privacy_url: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Link dos termos de uso
                    <input
                      type="url"
                      value={site.terms_url}
                      placeholder="https://..."
                      onChange={(e) =>
                        setSite({ ...site, terms_url: e.target.value })
                      }
                    />
                  </label>
                </fieldset>
              </section>
            </div>
            <aside>
              <section className="management-card settings-preview">
                <span className="eyebrow">PRÉVIA DO RODAPÉ</span>
                <h2>{site.app_name || "Nome do aplicativo"}</h2>
                <p>
                  {site.footer_notice ||
                    "Seu aviso educacional aparecerá aqui."}
                </p>
                {site.support_email && (
                  <span>
                    <Mail size={15} />
                    {site.support_email}
                  </span>
                )}
              </section>
              <section className="management-card">
                <div className="card-heading">
                  <h2>Métricas do site</h2>
                  <BarChart3 size={20} />
                </div>
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={site.analytics_enabled === "1"}
                    disabled={busy}
                    onChange={(e) =>
                      setSite({
                        ...site,
                        analytics_enabled: e.target.checked ? "1" : "0",
                      })
                    }
                  />
                  <span>Registrar visitas no site</span>
                </label>
                <p className="field-help">
                  Contagem de páginas e navegadores com um identificador
                  aleatório. Não armazena nome, e-mail, endereço IP ou termos de
                  busca. Acessos autenticados de administradores são excluídos.
                </p>
              </section>
              <div className="settings-save">
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}
                  Salvar configurações
                </button>
                <small>As mudanças aparecem ao atualizar o aplicativo.</small>
              </div>
            </aside>
          </form>
        )
      ) : (
        <div className="settings-layout">
          <div>
            <form className="management-card" onSubmit={(e) => saveAccount(e)}>
              <div className="card-heading">
                <div>
                  <h2>Minha conta</h2>
                  <p>Seus dados de acesso ao painel</p>
                </div>
                <ShieldCheck size={22} />
              </div>
              <fieldset className="settings-fields" disabled={busy}>
                <label>
                  Nome do administrador
                  <input
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
                <label>
                  E-mail do administrador
                  <input
                    type="email"
                    required
                    maxLength={190}
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </label>
              </fieldset>
              <div className="settings-actions">
                <button className="primary" disabled={busy}>
                  <Save size={17} />
                  Salvar minha conta
                </button>
              </div>
            </form>
            <form
              className="management-card password-card"
              onSubmit={(e) => saveAccount(e, true)}
            >
              <div className="card-heading">
                <div>
                  <h2>Trocar minha senha</h2>
                  <p>Crie uma nova senha para entrar no painel.</p>
                </div>
                <KeyRound size={22} />
              </div>
              <fieldset disabled={busy}>
                <NewPassword
                  value={password}
                  setValue={setPassword}
                  confirm={confirm}
                  setConfirm={setConfirm}
                />
              </fieldset>
              <p className="field-help">
                Você já está autenticado como administrador. A senha atual não é
                solicitada; as outras sessões serão encerradas.
              </p>
              <div className="settings-actions">
                <button className="primary" disabled={busy}>
                  <KeyRound size={17} />
                  Alterar minha senha
                </button>
              </div>
            </form>
          </div>
          <aside>
            <section className="management-card account-card">
              <span className="client-avatar large">
                {account.name.slice(0, 2)}
              </span>
              <h2>{account.name}</h2>
              <p>{account.email}</p>
              <span className="access-pill premium">
                <ShieldCheck size={15} />
                Administrador
              </span>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
