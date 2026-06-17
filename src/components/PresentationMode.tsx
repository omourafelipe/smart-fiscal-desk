import { useEffect, useRef, useState, useCallback } from "react";
import {
  X, ChevronLeft, ChevronRight, MonitorPlay,
  Maximize2, BarChart3, TrendingUp, Building2,
  PieChart, Activity,
} from "lucide-react";

/* ─── Slide definitions ─────────────────────────────────────────── */
const SLIDES = [
  { id: "kpis",            label: "KPIs Executivos",          Icon: TrendingUp },
  { id: "evolution",       label: "Evolução Faturamento",     Icon: Activity },
  { id: "ranking",         label: "Ranking de Empresas",      Icon: BarChart3 },
  { id: "consolidado",     label: "Participação Consolidado",  Icon: PieChart },
  { id: "intercompany",    label: "Intercompany",             Icon: Building2 },
  { id: "service-analysis",label: "Análise por Serviço",      Icon: BarChart3 },
];

function scrollToSlide(id: string) {
  // The dashboard sections have data-slide-id attributes set by index.tsx
  const el = document.querySelector(`[data-slide-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ─── PresentationMode component ────────────────────────────────── */
interface PresentationModeProps {
  onExit: () => void;
}

export function PresentationMode({ onExit }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* ── Enter browser fullscreen ── */
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  /* ── Scroll to first slide on mount ── */
  useEffect(() => {
    setTimeout(() => scrollToSlide(SLIDES[0].id), 200);
  }, []);

  /* ── Keyboard navigation ── */
  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, idx));
      setCurrentSlide(clamped);
      scrollToSlide(SLIDES[clamped].id);
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo(currentSlide + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo(currentSlide - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentSlide, goTo, onExit]);

  return (
    <>
      {/* Top presentation bar */}
      <div className="presentation-bar" ref={overlayRef}>
        <div className="presentation-bar-left">
          <MonitorPlay className="h-4 w-4" style={{ color: "#2563EB" }} />
          <span className="presentation-bar-title">Modo Apresentação</span>
        </div>

        {/* Slide dots */}
        <div className="presentation-slides">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              className={`presentation-dot${i === currentSlide ? " active" : ""}`}
              onClick={() => goTo(i)}
              title={slide.label}
            >
              {i === currentSlide && (
                <span className="presentation-dot-label">{slide.label}</span>
              )}
            </button>
          ))}
        </div>

        {/* Nav buttons */}
        <div className="presentation-controls">
          <button
            className="presentation-nav-btn"
            onClick={() => goTo(currentSlide - 1)}
            disabled={currentSlide === 0}
            title="Anterior (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="presentation-counter">
            {currentSlide + 1} / {SLIDES.length}
          </span>
          <button
            className="presentation-nav-btn"
            onClick={() => goTo(currentSlide + 1)}
            disabled={currentSlide === SLIDES.length - 1}
            title="Próximo (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="presentation-divider" />

          <button
            className="presentation-exit-btn"
            onClick={onExit}
            title="Sair (Esc)"
          >
            <X className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>

      {/* Slide name overlay (bottom-left) */}
      <div className="presentation-slide-label">
        {(() => { const SlideIcon = SLIDES[currentSlide].Icon; return <SlideIcon className="h-4 w-4" />; })()}
        {SLIDES[currentSlide].label}
      </div>
    </>
  );
}

/* ─── Fullscreen Toggle button ──────────────────────────────────── */
interface FullscreenButtonProps {
  className?: string;
}

export function FullscreenButton({ className }: FullscreenButtonProps) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <button
      id="fullscreen-btn"
      className={`fullscreen-btn${className ? ` ${className}` : ""}`}
      onClick={toggle}
      title={isFs ? "Sair da Tela Cheia (F)" : "Tela Cheia (F)"}
    >
      <Maximize2 className="h-4 w-4" />
    </button>
  );
}
