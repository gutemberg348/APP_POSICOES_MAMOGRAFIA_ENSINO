import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  Globe2,
  Handshake,
  ImagePlus,
  LayoutTemplate,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  Radio,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import "./advertising.css";

type Request = <T>(
  route: string,
  method?: string,
  body?: unknown,
) => Promise<T>;
type Partner = {
  id: number;
  name: string;
  description: string;
  website: string;
  logo_url: string | null;
  status: number;
  order_position: number;
};
type Campaign = {
  id: number;
  partner_id: number;
  partner_name: string;
  partner_status: number;
  title: string;
  description: string;
  url: string;
  cta: string;
  image_url: string | null;
  placements: string[];
  start_on: string | null;
  end_on: string | null;
  status: number;
  order_position: number;
};
type Config = {
  partners_enabled: boolean;
  google_enabled: boolean;
  test_mode: boolean;
  hide_for_premium: boolean;
  admob_banner_id: string;
  adsense_enabled: boolean;
  adsense_client: string;
  adsense_slot: string;
  google_placements: string[];
  contact_email: string;
};
type Tab = "partners" | "banners" | "settings";
const places: Record<string, string> = {
  HOME: "Início",
  MEDIA: "Biblioteca",
  CONTENT: "Final do conteúdo",
  PARTNERS: "Área de parceiros",
};
const initialForm = {
  name: "",
  description: "",
  website: "",
  title: "",
  url: "",
  cta: "Saiba mais",
  partner_id: "",
  status: "1",
  order_position: "0",
  start_on: "",
  end_on: "",
  remove_logo: "0",
  remove_image: "0",
};
function stateOf(c: Campaign) {
  const today = new Date().toISOString().slice(0, 10);
  return c.partner_status !== 1
    ? "Parceiro inativo"
    : !c.status
      ? "Pausada"
      : c.end_on && c.end_on < today
        ? "Encerrada"
        : c.start_on && c.start_on > today
          ? "Agendada"
          : "No ar";
}
export default function Advertising({
  api,
  notify,
}: {
  api: Request;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [banners, setBanners] = useState<Campaign[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{
    kind: "partners" | "banners";
    item: Partner | Campaign | null;
  } | null>(null);
  const [form, setForm] = useState(initialForm);
  const [placements, setPlacements] = useState<string[]>(["MEDIA"]);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [removing, setRemoving] = useState<{
    kind: "partners" | "banners";
    id: number;
    name: string;
  } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      api<Partner[]>("/admin/partners"),
      api<Campaign[]>("/admin/banners"),
      api<Config>("/admin/advertising"),
    ])
      .then(([p, b, c]) => {
        if (!cancelled) {
          setPartners(p);
          setBanners(b);
          setConfig(c);
        }
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
  }, [api, refresh]);
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!editor && !removing) return;
    const opener = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        setEditor(null);
        setRemoving(null);
      }
      if (e.key === "Tab") {
        const nodes = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea,select,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      opener?.focus();
    };
  }, [editor, removing, busy]);
  const update = (key: keyof typeof initialForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  function open(
    kind: "partners" | "banners",
    item: Partner | Campaign | null = null,
  ) {
    setEditor({ kind, item });
    setFormError("");
    setFile(null);
    const next = { ...initialForm, status: kind === "banners" ? "0" : "1" };
    if (item)
      for (const key of Object.keys(next) as (keyof typeof next)[])
        if (key in item)
          next[key] = String(
            (item as unknown as Record<string, unknown>)[key] ?? "",
          );
    setForm(next);
    setPlacements(item && "placements" in item ? item.placements : ["MEDIA"]);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setBusy(true);
    setFormError("");
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.set(key, value));
      data.set("placements", JSON.stringify(placements));
      if (file) data.set(editor.kind === "partners" ? "logo" : "image", file);
      await api(
        `/admin/${editor.kind}${editor.item ? "/" + editor.item.id : ""}`,
        "POST",
        data,
      );
      setEditor(null);
      setRefresh((n) => n + 1);
      notify(
        editor.kind === "partners" ? "Parceiro salvo." : "Campanha salva.",
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(
    kind: "partners" | "banners",
    item: Partner | Campaign,
  ) {
    setBusy(true);
    try {
      await api(`/admin/${kind}/${item.id}`, "PUT", {
        status: item.status ? 0 : 1,
      });
      setRefresh((n) => n + 1);
      notify(item.status ? "Exibição pausada." : "Exibição ativada.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/admin/${removing.kind}/${removing.id}`, "DELETE");
      setRemoving(null);
      setRefresh((n) => n + 1);
      notify("Cadastro arquivado.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/advertising", "PUT", config);
      notify("Configurações de publicidade salvas.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filteredPartners = partners.filter((p) =>
    (p.name + " " + p.description)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const filteredBanners = banners.filter((b) =>
    (b.title + " " + b.partner_name)
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const currentImage =
    filePreview ||
    (editor?.kind === "partners"
      ? (editor.item as Partner)?.logo_url
      : (editor?.item as Campaign)?.image_url) ||
    "";
  return (
    <div className="advertising-page">
      <div className="partnership-heading">
        <div>
          <span className="eyebrow">CONEXÕES QUE GERAM VALOR</span>
          <h1>Parcerias & publicidade</h1>
          <p>Marcas, campanhas e oportunidades. Tudo no lugar certo.</p>
        </div>
        <div className="partnership-symbol">
          <Handshake size={48} />
          <span>Juntos, vamos além.</span>
        </div>
      </div>
      <div className="promotion-summary">
        <div>
          <Handshake />
          <strong>{partners.filter((p) => p.status === 1).length}</strong>
          <span>parceiros ativos</span>
        </div>
        <div>
          <Radio />
          <strong>
            {banners.filter((b) => stateOf(b) === "No ar").length}
          </strong>
          <span>campanhas no ar</span>
        </div>
        <div>
          <LayoutTemplate />
          <strong>4</strong>
          <span>locais de exibição</span>
        </div>
      </div>
      <div
        className="promotion-tabs"
        role="tablist"
        aria-label="Gestão de publicidade"
      >
        {(
          [
            { id: "partners", label: "Parceiros", icon: Handshake },
            { id: "banners", label: "Campanhas", icon: Megaphone },
            { id: "settings", label: "Google Ads & ajustes", icon: Globe2 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "selected" : ""}
            onClick={() => {
              setTab(t.id);
              setSearch("");
            }}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="error" role="alert">
          {error}{" "}
          <button
            className="secondary"
            onClick={() => setRefresh((n) => n + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="empty">
          <LoaderCircle className="spin" />
          Carregando parcerias...
        </div>
      ) : (
        <>
          {tab !== "settings" && (
            <>
              <div className="promotion-toolbar">
                <div>
                  <h2>
                    {tab === "partners"
                      ? "Quem caminha com a gente"
                      : "Campanhas que conectam"}
                  </h2>
                  <p>
                    {tab === "partners"
                      ? "Cadastre a marca antes de criar sua campanha."
                      : "Escolha a mensagem, o período e onde ela vai aparecer."}
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => open(tab)}
                  disabled={tab === "banners" && !partners.length}
                >
                  <Plus size={18} />
                  {tab === "partners" ? "Novo parceiro" : "Nova campanha"}
                </button>
              </div>
              {(tab === "partners" ? partners : banners).length > 0 && (
                <div className="promotion-search">
                  <input
                    aria-label="Buscar parcerias"
                    placeholder={
                      tab === "partners"
                        ? "Buscar parceiro..."
                        : "Buscar campanha ou parceiro..."
                    }
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              {(tab === "partners" ? filteredPartners : filteredBanners)
                .length === 0 ? (
                <div className="promotion-empty">
                  <div className="empty-art">
                    <Handshake size={42} />
                    <span />
                    <i />
                  </div>
                  <span className="eyebrow">ESPAÇO PARA BOAS CONEXÕES</span>
                  <h3>
                    {search
                      ? "Nenhum resultado encontrado"
                      : tab === "partners"
                        ? "Sua próxima parceria começa aqui"
                        : "Dê visibilidade aos seus parceiros"}
                  </h3>
                  <p>
                    {search
                      ? "Experimente buscar por outro nome."
                      : tab === "partners"
                        ? "Adicione a identidade da marca, uma apresentação e o site. Depois, publique campanhas nos espaços do aplicativo."
                        : "Crie um banner, defina o período e escolha os locais de exibição. A prévia ajuda a conferir tudo antes de publicar."}
                  </p>
                  {!search && (
                    <button
                      className="primary"
                      onClick={() =>
                        partners.length || tab === "partners"
                          ? open(tab)
                          : setTab("partners")
                      }
                    >
                      <Plus size={18} />
                      {tab === "partners" || !partners.length
                        ? "Cadastrar parceiro"
                        : "Criar campanha"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="promotion-grid">
                  {tab === "partners"
                    ? filteredPartners.map((p) => (
                        <article className="partner-admin-card" key={p.id}>
                          <div className="partner-card-top">
                            <div className="partner-logo">
                              {p.logo_url ? (
                                <img src={p.logo_url} alt={`Logo ${p.name}`} />
                              ) : (
                                <span>{p.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <span
                              className={`promotion-status ${p.status ? "live" : ""}`}
                            >
                              {p.status ? "Ativo" : "Pausado"}
                            </span>
                          </div>
                          <h3>{p.name}</h3>
                          <p>
                            {p.description ||
                              "Apresentação da marca ainda não adicionada."}
                          </p>
                          {p.website && (
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="partner-site"
                            >
                              <Globe2 size={15} />
                              Visitar site
                              <ArrowUpRight size={15} />
                            </a>
                          )}
                          <div className="promotion-card-actions">
                            <button
                              className={`status-toggle ${p.status ? "on" : ""}`}
                              role="switch"
                              aria-checked={!!p.status}
                              aria-label={`${p.status ? "Pausar" : "Ativar"} parceiro ${p.name}`}
                              onClick={() => toggle("partners", p)}
                              disabled={busy}
                            >
                              <span />
                              {p.status ? "Visível" : "Oculto"}
                            </button>
                            <div>
                              <button
                                className="icon-button"
                                aria-label={`Editar parceiro ${p.name}`}
                                onClick={() => open("partners", p)}
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                className="icon-button delete"
                                aria-label={`Arquivar parceiro ${p.name}`}
                                onClick={() => {
                                  setFormError("");
                                  setRemoving({
                                    kind: "partners",
                                    id: p.id,
                                    name: p.name,
                                  });
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    : filteredBanners.map((b) => (
                        <article className="campaign-admin-card" key={b.id}>
                          <div className="campaign-art">
                            {b.image_url ? (
                              <img src={b.image_url} alt={b.title} />
                            ) : (
                              <Megaphone size={44} />
                            )}
                            <span>PUBLICIDADE</span>
                          </div>
                          <div className="campaign-card-body">
                            <div className="campaign-meta">
                              <span>{b.partner_name}</span>
                              <span
                                className={`promotion-status ${stateOf(b) === "No ar" ? "live" : ""}`}
                              >
                                {stateOf(b)}
                              </span>
                            </div>
                            <h3>{b.title}</h3>
                            <p>{b.description}</p>
                            <div className="placement-tags">
                              {b.placements.map((v) => (
                                <span key={v}>{places[v]}</span>
                              ))}
                            </div>
                            <div className="campaign-dates">
                              <CalendarDays size={14} />
                              {b.start_on || "Início imediato"} ·{" "}
                              {b.end_on || "Sem término"}
                            </div>
                            <div className="promotion-card-actions">
                              <button
                                className={`status-toggle ${b.status ? "on" : ""}`}
                                role="switch"
                                aria-checked={!!b.status}
                                aria-label={`${b.status ? "Pausar" : "Ativar"} campanha ${b.title}`}
                                onClick={() => toggle("banners", b)}
                                disabled={busy}
                              >
                                <span />
                                {b.status ? "Ativada" : "Pausada"}
                              </button>
                              <div>
                                <button
                                  className="icon-button"
                                  aria-label={`Editar campanha ${b.title}`}
                                  onClick={() => open("banners", b)}
                                >
                                  <Pencil size={18} />
                                </button>
                                <button
                                  className="icon-button delete"
                                  aria-label={`Arquivar campanha ${b.title}`}
                                  onClick={() => {
                                    setFormError("");
                                    setRemoving({
                                      kind: "banners",
                                      id: b.id,
                                      name: b.title,
                                    });
                                  }}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                </div>
              )}
            </>
          )}
          {tab === "settings" && config && (
            <form className="ad-settings" onSubmit={saveSettings}>
              <section className="settings-card">
                <div className="settings-heading">
                  <ShieldCheck />
                  <div>
                    <h2>Uma experiência equilibrada</h2>
                    <p>Escolha como a publicidade participa do aplicativo.</p>
                  </div>
                </div>
                {(
                  [
                    {
                      key: "partners_enabled",
                      title: "Exibir parceiros e campanhas",
                      copy: "Controla a presença das marcas e seus banners no aplicativo.",
                    },
                    {
                      key: "hide_for_premium",
                      title: "Ocultar anúncios para Premium",
                      copy: "Remove banners de campanhas e Google Ads. O diretório de parceiros continua disponível.",
                    },
                  ] as const
                ).map((v) => (
                  <label className="setting-toggle" key={v.key}>
                    <span>
                      <strong>{v.title}</strong>
                      <small>{v.copy}</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={config[v.key]}
                      onChange={(e) =>
                        setConfig({ ...config, [v.key]: e.target.checked })
                      }
                    />
                  </label>
                ))}
                <label>
                  Contato comercial
                  <input
                    type="email"
                    placeholder="parcerias@suaempresa.com.br"
                    value={config.contact_email}
                    onChange={(e) =>
                      setConfig({ ...config, contact_email: e.target.value })
                    }
                  />
                  <small>
                    O botão “Seja parceiro” abre uma mensagem para este
                    endereço.
                  </small>
                </label>
              </section>
              <section className="settings-card">
                <div className="settings-heading">
                  <Radio />
                  <div>
                    <h2>Google AdMob · Android</h2>
                    <p>Banners integrados ao aplicativo nativo.</p>
                  </div>
                </div>
                <label className="setting-toggle">
                  <span>
                    <strong>Ativar banners AdMob</strong>
                    <small>
                      A integração usa os locais selecionados abaixo.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={config.google_enabled}
                    onChange={(e) =>
                      setConfig({ ...config, google_enabled: e.target.checked })
                    }
                  />
                </label>
                <label className="setting-toggle">
                  <span>
                    <strong>Modo de teste</strong>
                    <small>
                      Exibe somente anúncios de teste do Google no Android.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={config.test_mode}
                    onChange={(e) =>
                      setConfig({ ...config, test_mode: e.target.checked })
                    }
                  />
                </label>
                <label>
                  ID do bloco de banner
                  <input
                    value={config.admob_banner_id}
                    placeholder="ca-app-pub-0000000000000000/0000000000"
                    onChange={(e) =>
                      setConfig({ ...config, admob_banner_id: e.target.value })
                    }
                  />
                </label>
                <p className="settings-note">
                  O ID do aplicativo AdMob é definido em ADMOB_ANDROID_APP_ID
                  antes de gerar o Android. O bloco, os locais e a ativação são
                  controlados aqui. Expo Go e a prévia web não exibem AdMob.
                </p>
              </section>
              <section className="settings-card">
                <div className="settings-heading">
                  <Globe2 />
                  <div>
                    <h2>Google AdSense · Web</h2>
                    <p>Um bloco de anúncio na versão web publicada.</p>
                  </div>
                </div>
                <label className="setting-toggle">
                  <span>
                    <strong>Ativar bloco AdSense</strong>
                    <small>
                      Requer domínio aprovado pelo Google. Localhost não
                      solicita anúncios.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={config.adsense_enabled}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        adsense_enabled: e.target.checked,
                      })
                    }
                  />
                </label>
                <label>
                  ID do editor
                  <input
                    value={config.adsense_client}
                    placeholder="ca-pub-0000000000000000"
                    onChange={(e) =>
                      setConfig({ ...config, adsense_client: e.target.value })
                    }
                  />
                </label>
                <label>
                  ID do bloco
                  <input
                    value={config.adsense_slot}
                    placeholder="0000000000"
                    onChange={(e) =>
                      setConfig({ ...config, adsense_slot: e.target.value })
                    }
                  />
                </label>
                <p className="settings-note">
                  Configure as mensagens de privacidade na conta Google antes de
                  publicar os anúncios.
                </p>
              </section>
              <section className="settings-card">
                <div className="settings-heading">
                  <LayoutTemplate />
                  <div>
                    <h2>Locais dos anúncios Google</h2>
                    <p>Os banners aparecem em pausas naturais da navegação.</p>
                  </div>
                </div>
                <div className="placement-options">
                  {Object.entries(places).map(([id, label]) => (
                    <label key={id}>
                      <input
                        type="checkbox"
                        checked={config.google_placements.includes(id)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            google_placements: e.target.checked
                              ? [...config.google_placements, id]
                              : config.google_placements.filter(
                                  (v) => v !== id,
                                ),
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="placement-explanation">
                  <div className="mini-phone">
                    <i />
                    <b />
                    <b />
                    <span>Publicidade</span>
                    <b />
                  </div>
                  <p>
                    Conteúdo primeiro.
                    <br />
                    <strong>Publicidade com espaço próprio.</strong>
                    <br />
                    Sem anúncios sobre imagens, players ou controles.
                  </p>
                </div>
              </section>
              <div className="settings-save">
                <span>
                  As alterações passam a valer ao atualizar o aplicativo.
                </span>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  Salvar configurações
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {editor && (
        <div className="overlay">
          <div
            ref={dialog}
            tabIndex={-1}
            className="modal promotion-editor"
            role="dialog"
            aria-modal="true"
            aria-label={
              editor.kind === "partners"
                ? "Cadastro de parceiro"
                : "Cadastro de campanha"
            }
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {editor.kind === "partners"
                    ? "IDENTIDADE DA MARCA"
                    : "SUA CAMPANHA"}
                </span>
                <h2>
                  {editor.item
                    ? "Editar"
                    : editor.kind === "partners"
                      ? "Novo"
                      : "Nova"}{" "}
                  {editor.kind === "partners" ? "parceiro" : "campanha"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setEditor(null)}
                disabled={busy}
                aria-label="Fechar cadastro"
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="promotion-editor-body">
                <div className="promotion-fields">
                  {editor.kind === "partners" ? (
                    <>
                      <label>
                        Nome do parceiro
                        <input
                          required
                          maxLength={120}
                          value={form.name}
                          onChange={(e) => update("name", e.target.value)}
                        />
                      </label>
                      <label>
                        Apresentação
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={form.description}
                          onChange={(e) =>
                            update("description", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Site do parceiro
                        <input
                          type="url"
                          placeholder="https://"
                          value={form.website}
                          onChange={(e) => update("website", e.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        Parceiro
                        <select
                          aria-label="Parceiro"
                          required
                          value={form.partner_id}
                          onChange={(e) => update("partner_id", e.target.value)}
                        >
                          <option value="">Selecione uma marca</option>
                          {partners.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                              {p.status ? "" : " (pausado)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Título da campanha
                        <input
                          required
                          maxLength={120}
                          value={form.title}
                          onChange={(e) => update("title", e.target.value)}
                        />
                      </label>
                      <label>
                        Descrição
                        <textarea
                          rows={2}
                          maxLength={300}
                          value={form.description}
                          onChange={(e) =>
                            update("description", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Link de destino
                        <input
                          type="url"
                          required
                          placeholder="https://"
                          value={form.url}
                          onChange={(e) => update("url", e.target.value)}
                        />
                      </label>
                      <label>
                        Texto do botão
                        <input
                          required
                          maxLength={40}
                          value={form.cta}
                          onChange={(e) => update("cta", e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <label className="promotion-upload">
                    <ImagePlus size={25} />
                    <strong>
                      {file
                        ? file.name
                        : editor.kind === "partners"
                          ? "Adicionar logo"
                          : "Adicionar banner"}
                    </strong>
                    <small>
                      {editor.kind === "partners"
                        ? "Logo quadrado com fundo transparente."
                        : "Formato sugerido: 1200 × 480 px. Sem imagem, a campanha usa um card de texto."}{" "}
                      JPG, PNG ou WebP, até 5 MB.
                    </small>
                    <input
                      type="file"
                      className="visually-hidden"
                      aria-label={
                        editor.kind === "partners"
                          ? "Logo do parceiro"
                          : "Imagem da campanha"
                      }
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        update(
                          editor.kind === "partners"
                            ? "remove_logo"
                            : "remove_image",
                          "0",
                        );
                      }}
                    />
                    <span className="secondary">Selecionar imagem</span>
                  </label>
                  {editor.item && currentImage && (
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={
                          form[
                            editor.kind === "partners"
                              ? "remove_logo"
                              : "remove_image"
                          ] === "1"
                        }
                        onChange={(e) =>
                          update(
                            editor.kind === "partners"
                              ? "remove_logo"
                              : "remove_image",
                            e.target.checked ? "1" : "0",
                          )
                        }
                      />
                      Remover imagem atual
                    </label>
                  )}
                  {editor.kind === "banners" && (
                    <>
                      <fieldset className="placement-field">
                        <legend>Onde exibir</legend>
                        <div className="placement-options">
                          {Object.entries(places).map(([id, label]) => (
                            <label key={id}>
                              <input
                                type="checkbox"
                                checked={placements.includes(id)}
                                onChange={(e) =>
                                  setPlacements(
                                    e.target.checked
                                      ? [...placements, id]
                                      : placements.filter((v) => v !== id),
                                  )
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="promotion-form-row">
                        <label>
                          Início (UTC)
                          <input
                            type="date"
                            value={form.start_on}
                            onChange={(e) => update("start_on", e.target.value)}
                          />
                        </label>
                        <label>
                          Término (UTC)
                          <input
                            type="date"
                            min={form.start_on || undefined}
                            value={form.end_on}
                            onChange={(e) => update("end_on", e.target.value)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                  <div className="promotion-form-row">
                    <label>
                      Status
                      <select
                        aria-label="Status"
                        value={form.status}
                        onChange={(e) => update("status", e.target.value)}
                      >
                        <option value="0">Pausado</option>
                        <option value="1">Ativo</option>
                      </select>
                    </label>
                    <label>
                      Ordem de exibição
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={form.order_position}
                        onChange={(e) =>
                          update("order_position", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  {formError && (
                    <div className="error" role="alert">
                      {formError}
                    </div>
                  )}
                </div>
                <aside className="promotion-live-preview">
                  <span>
                    <Eye size={16} />
                    PRÉVIA NO APLICATIVO
                  </span>
                  <div
                    className={`preview-promotion ${editor.kind === "partners" ? "brand-preview" : ""}`}
                  >
                    {currentImage &&
                    form[
                      editor.kind === "partners"
                        ? "remove_logo"
                        : "remove_image"
                    ] !== "1" ? (
                      <img
                        src={currentImage}
                        alt="Prévia da imagem selecionada"
                      />
                    ) : (
                      <div className="preview-placeholder">
                        {editor.kind === "partners" ? (
                          <Handshake size={42} />
                        ) : (
                          <Megaphone size={42} />
                        )}
                      </div>
                    )}
                    <div>
                      <small>
                        {editor.kind === "partners"
                          ? "PARCEIRO"
                          : `PUBLICIDADE · ${partners.find((p) => p.id === Number(form.partner_id))?.name || "Nome do parceiro"}`}
                      </small>
                      <h3>
                        {editor.kind === "partners"
                          ? form.name || "Nome da marca"
                          : form.title || "Uma mensagem que conecta"}
                      </h3>
                      <p>
                        {form.description ||
                          "A apresentação aparece aqui, com espaço para sua marca se destacar."}
                      </p>
                      <span>
                        {editor.kind === "partners"
                          ? "Conhecer parceiro"
                          : form.cta || "Saiba mais"}
                        <ArrowUpRight size={17} />
                      </span>
                    </div>
                  </div>
                  <p>
                    Prévia ilustrativa. O formato se adapta à largura da tela.
                  </p>
                  <div className="preview-tip">
                    <Check size={17} />
                    Só campanhas ativas, dentro do período e com parceiro ativo
                    aparecem no app.
                  </div>
                </aside>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Check size={17} />
                  )}
                  Salvar {editor.kind === "partners" ? "parceiro" : "campanha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {removing && (
        <div className="overlay">
          <div
            ref={dialog}
            tabIndex={-1}
            className="modal delete-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Arquivar cadastro"
          >
            <Trash2 color="#b83d68" />
            <h2>
              Arquivar {removing.kind === "partners" ? "parceiro" : "campanha"}?
            </h2>
            <p>
              “{removing.name}” deixará de aparecer no aplicativo.
              {removing.kind === "partners"
                ? " Suas campanhas também deixam de ser exibidas."
                : ""}{" "}
              Os arquivos serão preservados.
            </p>
            {formError && <div className="error">{formError}</div>}
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={busy} onClick={archive}>
                Arquivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
