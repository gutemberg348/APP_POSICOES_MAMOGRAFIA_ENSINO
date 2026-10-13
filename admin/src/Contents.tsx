import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, LoaderCircle, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import "./contents.css";

type Request = <T>(route: string, method?: string, body?: unknown) => Promise<T>;
type Entry = { id: number; topic_id: number; title: string; category_name: string; source_pages: string | null; block_count: number; status: number };
type Block = { id: number | null; type: string; title: string | null; body: string; status?: number; key: string };
type Detail = Entry & { revision: string; blocks: Block[] };
const types: Record<string, string> = {
  paragraph: "Texto", numbered_list: "Etapas numeradas", quality_criteria: "Critérios de qualidade",
  common_errors: "Erros comuns", tip: "Dica extra", important: "Importante",
};

export default function Contents({ api, notify }: { api: Request; notify: (message: string) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const serial = useRef(0);
  const mounted = useRef(true);
  const formTop = useRef<HTMLHeadingElement>(null);
  const original = useRef("");
  const snapshot = (value: Detail) => JSON.stringify({ title: value.title, blocks: value.blocks });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api<Entry[]>("/admin/contents").then((rows) => { if (active) setEntries(rows); })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, refresh]);
  useEffect(() => { if (detail) formTop.current?.focus(); }, [detail?.id]);
  const dirty = detail !== null && snapshot(detail) !== original.current;
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  async function open(id: number) {
    setLoading(true); setError("");
    try {
      const value = await api<Detail>(`/admin/contents/${id}`);
      if (!mounted.current) return;
      value.blocks = value.blocks.map((block) => ({ ...block, key: `existing-${block.id}` }));
      original.current = snapshot(value);
      setDetail(value);
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  }
  function close() {
    if (dirty && !window.confirm("Descartar as alterações que ainda não foram salvas?")) return;
    setDetail(null); setError("");
  }
  function update(index: number, patch: Partial<Block>) {
    setDetail((value) => value && ({ ...value, blocks: value.blocks.map((block, i) => i === index ? { ...block, ...patch } : block) }));
  }
  function move(index: number, offset: number) {
    if (!detail) return;
    const blocks = [...detail.blocks];
    [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]];
    setDetail({ ...detail, blocks });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || saving) return;
    setSaving(true); setError("");
    try {
      await api(`/admin/contents/${detail.id}`, "PUT", {
        title: detail.title, revision: detail.revision,
        blocks: detail.blocks.map(({ id, type, title, body }) => ({ id, type, title: title || "", body })),
      });
      if (!mounted.current) return;
      setDetail(null); setRefresh((v) => v + 1);
      notify("Conteúdo salvo. O texto atualizado já está disponível no aplicativo.");
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setSaving(false); }
  }
  if (detail) return (
    <div className="management-page manual-editor">
      <button className="secondary" type="button" onClick={close} disabled={saving}><ArrowLeft size={17} />Voltar aos conteúdos</button>
      <div className="page-heading"><div>
        <span className="eyebrow">CONTEÚDOS DO MANUAL</span>
        <h1 ref={formTop} tabIndex={-1}>Editar conteúdo</h1>
        <p>{detail.category_name}{detail.source_pages ? ` · PDF original: páginas ${detail.source_pages}` : ""}</p>
      </div></div>
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <div className="manual-title-card">
            <label>Título do conteúdo<input required maxLength={190} value={detail.title} onChange={(e) => setDetail({ ...detail, title: e.target.value })} /></label>
            <p>As alterações aparecem na aba Conteúdo do aplicativo ao abrir novamente o tópico. Salve para publicar.</p>
          </div>
          {detail.blocks.map((block, index) => (
            <section className="manual-block" key={block.key} aria-label={`Seção ${index + 1}`}>
              <div className="manual-block-heading">
                <h2>Seção {index + 1}{block.status === 0 ? " · Oculta no aplicativo" : ""}</h2>
                <div>
                  <button type="button" className="icon-button bordered" aria-label={`Mover seção ${index + 1} para cima`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
                  <button type="button" className="icon-button bordered" aria-label={`Mover seção ${index + 1} para baixo`} disabled={index === detail.blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
                  <button type="button" className="icon-button bordered" aria-label={`Remover seção ${index + 1}`} disabled={detail.blocks.length === 1} onClick={() => setDetail({ ...detail, blocks: detail.blocks.filter((_, i) => i !== index) })}><Trash2 size={18} /></button>
                </div>
              </div>
              <div className="manual-block-fields">
                <label>Tipo da seção {index + 1}<select aria-label={`Tipo da seção ${index + 1}`} value={block.type} onChange={(e) => update(index, { type: e.target.value })}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Título da seção {index + 1}<input maxLength={190} value={block.title || ""} placeholder="Opcional" onChange={(e) => update(index, { title: e.target.value })} /></label>
              </div>
              <label>Texto da seção {index + 1}<textarea aria-label={`Texto da seção ${index + 1}`} required maxLength={50000} rows={Math.min(14, Math.max(4, (block.body || "").split("\n").length + 1))} value={block.body || ""} onChange={(e) => update(index, { body: e.target.value })} /></label>
              <p className="manual-help">{block.type === "numbered_list" ? "Escreva cada etapa em uma nova linha, começando com 1., 2., 3.…" : ["quality_criteria", "common_errors"].includes(block.type) ? "Escreva cada item em uma nova linha." : "Separe os parágrafos com uma linha em branco."}</p>
            </section>
          ))}
          <button type="button" className="secondary" disabled={detail.blocks.length >= 100} onClick={() => setDetail({ ...detail, blocks: [...detail.blocks, { id: null, key: `new-${++serial.current}`, type: "paragraph", title: "", body: "" }] })}><Plus size={18} />Adicionar seção</button>
        </fieldset>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="manual-save-bar">
          <span>{dirty ? "Alterações ainda não salvas" : "Conteúdo carregado para edição"}</span>
          <button className="secondary" type="button" onClick={close} disabled={saving}>Cancelar</button>
          <button className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}{saving ? "Salvando…" : "Salvar conteúdo"}</button>
        </div>
      </form>
    </div>
  );
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = entries.filter((entry) => normalize(`${entry.title} ${entry.category_name}`).includes(normalize(search)));
  return (
    <div className="management-page manual-page">
      <div className="page-heading"><div><span className="eyebrow">TEXTOS E POSICIONAMENTOS</span><h1>Conteúdos do manual</h1><p>Atualize os títulos, orientações e etapas exibidos no aplicativo.</p></div></div>
      <div className="library">
        <div className="manual-toolbar"><label className="search"><Search size={18} /><input aria-label="Buscar conteúdo" placeholder="Buscar título ou categoria…" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span>{filtered.length} conteúdos</span></div>
        {error && <div className="error" role="alert">{error}<button className="secondary" onClick={() => setRefresh((v) => v + 1)}>Tentar novamente</button></div>}
        {loading ? <div className="management-loading" role="status"><LoaderCircle className="spin" />Carregando conteúdos…</div> : (
          <div className="manual-list">{filtered.map((entry) => <div className="manual-entry" key={entry.id}>
            <BookOpen size={22} /><div><strong>{entry.title}</strong><span>{entry.category_name} · {entry.block_count} seções{entry.status === 0 ? " · Oculto" : ""}</span></div>
            <button className="secondary" aria-label={`Editar ${entry.title}`} onClick={() => open(entry.id)}><Pencil size={16} />Editar</button>
          </div>)}{!filtered.length && !error && <p className="manual-empty">Nenhum conteúdo encontrado.</p>}</div>
        )}
      </div>
    </div>
  );
}
