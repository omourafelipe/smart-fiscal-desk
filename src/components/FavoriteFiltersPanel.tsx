import { useState } from "react";
import { Star, Plus, Trash2, Check, ChevronDown, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useFiscalStore, type SavedFilter } from "@/store/useFiscalStore";

const MESES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function filterSummary(f: SavedFilter): string {
  const parts: string[] = [];
  if (f.mesFiltro && f.anoFiltro)
    parts.push(`${MESES[f.mesFiltro]}/${f.anoFiltro}`);
  else if (f.anoFiltro) parts.push(f.anoFiltro);
  else if (f.mesFiltro) parts.push(MESES[f.mesFiltro] ?? f.mesFiltro);
  if (f.empresaFiltro) parts.push("Empresa específica");
  if (f.statusFiltro !== "Ativo") parts.push(f.statusFiltro);
  if (f.operacaoFiltro !== "Todas") parts.push(f.operacaoFiltro);
  return parts.length > 0 ? parts.join(" · ") : "Todos os filtros limpos";
}

export function FavoriteFiltersPanel() {
  const {
    savedFilters,
    saveCurrentFilter,
    removeSavedFilter,
    applySavedFilter,
    mesFiltro, anoFiltro, empresaFiltro, statusFiltro, operacaoFiltro,
  } = useFiscalStore();

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const name = newName.trim() || `Filtro ${new Date().toLocaleDateString("pt-BR")}`;
    saveCurrentFilter(name);
    setNewName("");
    setSaving(false);
    toast.success(`Filtro "${name}" salvo`);
  };

  const handleApply = (id: string, name: string) => {
    applySavedFilter(id);
    setOpen(false);
    toast.success(`Filtro "${name}" aplicado`);
  };

  const handleRemove = (id: string, name: string) => {
    removeSavedFilter(id);
    toast.success(`Filtro "${name}" removido`);
  };

  return (
    <div className="fav-filter-wrapper">
      <button
        id="fav-filters-btn"
        className={`fav-filter-trigger${open ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Filtros Favoritos"
      >
        <Star className="h-4 w-4" />
        {savedFilters.length > 0 && (
          <span className="fav-filter-badge">{savedFilters.length}</span>
        )}
        <ChevronDown
          className="h-3 w-3 opacity-50"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fav-filter-panel">
            <div className="fav-filter-panel-header">
              <Bookmark className="h-3.5 w-3.5" />
              Filtros Favoritos
            </div>

            {/* Current filter → save */}
            {!saving ? (
              <button
                className="fav-filter-save-btn"
                onClick={() => setSaving(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Salvar filtro atual
              </button>
            ) : (
              <div className="fav-filter-save-row">
                <input
                  autoFocus
                  className="fav-filter-input"
                  placeholder="Nome do filtro…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setSaving(false);
                  }}
                  maxLength={40}
                />
                <button className="fav-filter-confirm-btn" onClick={handleSave} title="Confirmar">
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {savedFilters.length === 0 ? (
              <div className="fav-filter-empty">
                Nenhum filtro salvo ainda
              </div>
            ) : (
              <div className="fav-filter-list">
                {savedFilters.map((f) => (
                  <div key={f.id} className="fav-filter-item">
                    <button
                      className="fav-filter-item-main"
                      onClick={() => handleApply(f.id, f.name)}
                    >
                      <Star className="h-3 w-3 shrink-0" style={{ color: "#F59E0B" }} />
                      <div className="fav-filter-item-text">
                        <span className="fav-filter-item-name">{f.name}</span>
                        <span className="fav-filter-item-sub">{filterSummary(f)}</span>
                      </div>
                    </button>
                    <button
                      className="fav-filter-remove-btn"
                      onClick={() => handleRemove(f.id, f.name)}
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
