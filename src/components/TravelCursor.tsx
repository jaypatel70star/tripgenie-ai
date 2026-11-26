"use client";

import { useEffect, useRef } from "react";

type CursorVariant = "arrow" | "interactive" | "text" | "grab";

const INTERACTIVE_SELECTOR =
  "a, button, select, label, summary, [role='tab'], [role='button'], .leaflet-interactive";
const TEXT_SELECTOR =
  "input:not([type='range']):not([type='checkbox']):not([type='radio']):not([type='button']):not([type='submit']), textarea, [contenteditable='true']";
const GRAB_SELECTOR = ".cursor-grab, .leaflet-grab, .leaflet-container canvas, canvas[data-engine]";

/**
 * Custom zero-lag travel navigator cursor that hides the OS cursor on
 * fine-pointer desktop devices and morphs between jet-dart, interactive
 * pointer, text caret, and compass-grab states.
 */
export default function TravelCursor() {
  const layerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const arrowSvgRef = useRef<HTMLDivElement>(null);
  const textSvgRef = useRef<HTMLDivElement>(null);
  const grabSvgRef = useRef<HTMLDivElement>(null);
  const wingLeftRef = useRef<SVGPathElement>(null);
  const wingRightRef = useRef<SVGPathElement>(null);
  const hoverHaloRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasFinePointer = window.matchMedia("(any-pointer: fine)").matches;
    if (!hasFinePointer) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const layer = layerRef.current;
    const pointer = pointerRef.current;
    const arrowSvg = arrowSvgRef.current;
    const textSvg = textSvgRef.current;
    const grabSvg = grabSvgRef.current;
    const wingLeft = wingLeftRef.current;
    const wingRight = wingRightRef.current;
    const hoverHalo = hoverHaloRef.current;
    const ripple = rippleRef.current;

    if (!layer || !pointer || !arrowSvg || !textSvg || !grabSvg) return;

    const root = document.documentElement;
    if (window.matchMedia("(pointer: fine)").matches) {
      root.classList.add("custom-cursor-active");
    }

    const promoteTopLayer = () => {
      try {
        if ("showPopover" in layer) {
          if (layer.matches(":popover-open")) {
            layer.hidePopover();
          }
          layer.showPopover();
        }
      } catch {
        // Fallback smoothly to fixed z-index stacking if popover fails
      }
    };
    promoteTopLayer();

    const dialogObserver = new MutationObserver(() => {
      if (document.querySelector("dialog[open]")) {
        promoteTopLayer();
      }
    });
    dialogObserver.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });

    let mouseX = -100;
    let mouseY = -100;
    let visible = false;
    let variant: CursorVariant = "arrow";
    let pressed = false;
    let rippleAnim: Animation | null = null;

    const applyVariantStyles = () => {
      arrowSvg.style.display = variant === "arrow" || variant === "interactive" ? "block" : "none";
      textSvg.style.display = variant === "text" ? "block" : "none";
      grabSvg.style.display = variant === "grab" ? "block" : "none";

      if (hoverHalo) {
        hoverHalo.style.opacity = variant === "interactive" ? "1" : "0";
      }

      if (wingLeft && wingRight) {
        if (variant === "interactive") {
          wingLeft.setAttribute("fill", "url(#tg-cursor-gold)");
          wingRight.setAttribute("fill", "url(#tg-cursor-coral)");
        } else {
          wingLeft.setAttribute("fill", "url(#tg-cursor-cyan)");
          wingRight.setAttribute("fill", "url(#tg-cursor-gold)");
        }
      }

      const scale = pressed ? 0.88 : variant === "interactive" ? 1.12 : 1;
      const tilt = variant === "interactive" ? "-6deg" : "0deg";
      arrowSvg.style.transform = `translate(-2px, -2px) scale(${scale}) rotate(${tilt})`;
      grabSvg.style.transform = `translate(-50%, -50%) scale(${pressed ? 0.86 : 1}) rotate(${pressed ? "18deg" : "0deg"})`;
      textSvg.style.transform = `translate(-50%, -50%) scaleY(${pressed ? 0.9 : 1})`;
    };

    const detectVariant = (target: EventTarget | null): CursorVariant => {
      const el = target instanceof Element ? target : null;
      if (!el) return "arrow";
      if (el.closest(TEXT_SELECTOR)) return "text";
      if (el.closest(INTERACTIVE_SELECTOR)) return "interactive";
      if (el.closest(GRAB_SELECTOR)) return "grab";
      return "arrow";
    };

    const renderPosition = () => {
      pointer.style.opacity = visible ? "1" : "0";
      pointer.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        visible = false;
        root.classList.remove("custom-cursor-active");
        renderPosition();
        return;
      }
      root.classList.add("custom-cursor-active");
      mouseX = e.clientX;
      mouseY = e.clientY;
      visible = true;
      variant = detectVariant(e.target);
      renderPosition();
      applyVariantStyles();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        visible = false;
        root.classList.remove("custom-cursor-active");
        renderPosition();
        return;
      }
      root.classList.add("custom-cursor-active");
      pressed = true;
      mouseX = e.clientX;
      mouseY = e.clientY;
      visible = true;
      renderPosition();
      applyVariantStyles();

      if (ripple && !reducedMotion) {
        rippleAnim?.cancel();
        ripple.style.left = `${mouseX}px`;
        ripple.style.top = `${mouseY}px`;
        rippleAnim = ripple.animate(
          [
            { opacity: 0.85, transform: "translate(-50%, -50%) scale(0.3)" },
            { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" },
          ],
          { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
        );
      }
    };

    const onUp = () => {
      pressed = false;
      applyVariantStyles();
    };

    const onLeave = () => {
      visible = false;
      renderPosition();
    };

    const onEnter = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      visible = true;
      variant = detectVariant(e.target);
      renderPosition();
      applyVariantStyles();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      root.classList.remove("custom-cursor-active");
      dialogObserver.disconnect();
      rippleAnim?.cancel();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      try {
        if ("hidePopover" in layer && layer.matches(":popover-open")) {
          layer.hidePopover();
        }
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  return (
    <div
      ref={layerRef}
      popover="manual"
      aria-hidden="true"
      className="travel-cursor-layer pointer-events-none fixed inset-0 z-[2147483647]"
    >
      {/* Click Ripple Ring */}
      <div
        ref={rippleRef}
        className="pointer-events-none fixed h-7 w-7 rounded-full border border-amber-300/90 opacity-0 shadow-[0_0_12px_rgba(251,191,36,0.45)]"
      />

      {/* Zero-Lag Custom Cursor Anchor (hotspot exact at 0,0) */}
      <div
        ref={pointerRef}
        className="pointer-events-none fixed left-0 top-0 opacity-0 will-change-transform transition-opacity duration-150"
      >
        {/* Subtle Interactive Magnetic Halo */}
        <div
          ref={hoverHaloRef}
          className="pointer-events-none absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-amber-400/25 blur-[4px] opacity-0 transition-opacity duration-150"
        />

        {/* Default / Interactive: Sleek Travel Jet-Dart Pointer */}
        <div
          ref={arrowSvgRef}
          className="origin-top-left transition-transform duration-150 ease-out drop-shadow-[0_3px_10px_rgba(45,212,191,0.45)]"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="tg-cursor-cyan" x1="2" y1="2" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
              <linearGradient id="tg-cursor-gold" x1="2" y1="2" x2="24" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="tg-cursor-coral" x1="6" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>

            {/* Dark outer halo edge for high contrast over both bright map tiles & dark glass */}
            <path
              d="M2.2 2.2L24.5 11.4L14.5 14.5L11.4 24.5L2.2 2.2Z"
              stroke="#030b17"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            {/* Upper-Right Wing */}
            <path
              ref={wingRightRef}
              d="M2.2 2.2L24.5 11.4L14.5 14.5L2.2 2.2Z"
              fill="url(#tg-cursor-gold)"
              stroke="#030b17"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Lower-Left Wing */}
            <path
              ref={wingLeftRef}
              d="M2.2 2.2L14.5 14.5L11.4 24.5L2.2 2.2Z"
              fill="url(#tg-cursor-cyan)"
              stroke="#030b17"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            {/* Glowing Center Ridge */}
            <path
              d="M2.2 2.2L14.5 14.5"
              stroke="#ffffff"
              strokeOpacity="0.85"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Text Input State: Crisp Neon I-Beam */}
        <div
          ref={textSvgRef}
          style={{ display: "none" }}
          className="transition-transform duration-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]"
        >
          <svg
            width="16"
            height="22"
            viewBox="0 0 16 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 3H12M4 19H12M8 3V19"
              stroke="#030b17"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M4 3H12M4 19H12M8 3V19"
              stroke="#fde68a"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Globe / Map Drag State: 4-Way Compass Reticle */}
        <div
          ref={grabSvgRef}
          style={{ display: "none" }}
          className="transition-transform duration-150 drop-shadow-[0_0_10px_rgba(45,212,191,0.55)]"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="14" cy="14" r="9.5" stroke="#030b17" strokeWidth="3.2" />
            <circle cx="14" cy="14" r="9.5" stroke="#2dd4bf" strokeWidth="1.6" />
            <path
              d="M14 2.5L16.2 7H11.8L14 2.5ZM14 25.5L16.2 21H11.8L14 25.5ZM2.5 14L7 11.8V16.2L2.5 14ZM25.5 14L21 11.8V16.2L25.5 14Z"
              fill="#fbbf24"
              stroke="#030b17"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <circle cx="14" cy="14" r="2.2" fill="#f8fafc" />
          </svg>
        </div>
      </div>
    </div>
  );
}
