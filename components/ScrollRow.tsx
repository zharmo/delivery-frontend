// components/ScrollRow.tsx  (driver app — same as the main site's components/ui/ScrollRow.tsx)
//
// One sideways-scrolling row for the whole site: category chips, product
// types, filter chips, tabs, product carousels, photo thumbnails.
//
// WHY THIS EXISTS: the old rows hid their scrollbar. On a phone you could
// swipe, but nothing showed that more items were there ("Short Shoes" cut
// off at the edge). On a computer it was worse — a mouse cannot scroll a
// row whose scrollbar is hidden, so the last items were simply out of
// reach. The rule now: no item is ever out of reach, on any screen.
//
// What it does:
//   * An arrow button + soft fade appears on any side that has more items.
//     Tap/click it to move along. It disappears at the ends, and when
//     everything already fits, there are no arrows at all.
//   * Mouse users can also drag the row (a click still works as a click).
//   * The item marked data-active="true" is scrolled into view, so the
//     selected chip is never hidden off-screen.
//   * The side padding sits on an inner track, so the last item keeps its
//     gap from the edge (browsers drop right padding on a scrolling flex row).
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Classes for the track: gap, side padding, bottom padding. e.g. "gap-2 px-4 pb-0.5" */
  className?: string;
  /** Classes for the outer box (margins). */
  outerClassName?: string;
  /** Colour behind the row, so the edge fade blends in. */
  fadeColor?: string;
  /** "dark" for dark screens (the full-screen photo viewer). */
  tone?: "light" | "dark";
  /** Change this when the selection changes; the item with data-active="true" is scrolled into view. */
  activeKey?: string | number | null;
  /** Centre the items when they all fit (photo thumbnails). */
  center?: boolean;
  /** Snap cards to the start edge while swiping (product carousels). */
  snap?: boolean;
  ariaLabel?: string;
};

export default function ScrollRow({
  children,
  className = "",
  outerClassName = "",
  fadeColor = "#F4F5F9",
  tone = "light",
  activeKey,
  center = false,
  snap = false,
  ariaLabel,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  /* ── which sides have more items? ─────────────────────────────── */
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 2;
    const right = max > 2 && el.scrollLeft < max - 2;
    setEdges((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    measure();

    // Re-measure when the row or anything in it changes size (new chips,
    // counts loading in, fonts finishing, the screen turning).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(track);
    const mo = new MutationObserver(measure);
    mo.observe(track, { childList: true, subtree: true, characterData: true });
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* ── keep the selected item on screen ─────────────────────────── */
  const firstScroll = useRef(true);
  useEffect(() => {
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const item = track.querySelector<HTMLElement>('[data-active="true"]');
    const behavior: ScrollBehavior = firstScroll.current ? "auto" : "smooth";
    firstScroll.current = false;
    if (!item) return;

    const room = 52; // leaves space for the arrow button
    const left = item.offsetLeft;
    const right = left + item.offsetWidth;
    if (left < el.scrollLeft + room) {
      el.scrollTo({ left: Math.max(0, left - room), behavior });
    } else if (right > el.scrollLeft + el.clientWidth - room) {
      el.scrollTo({ left: right - el.clientWidth + room, behavior });
    }
  }, [activeKey]);

  /* ── arrow buttons ────────────────────────────────────────────── */
  function page(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.75), behavior: "smooth" });
  }

  /* ── drag with a mouse (touch already swipes natively) ────────── */
  const drag = useRef<{ x: number; start: number; moved: boolean; id: number } | null>(null);
  const swallowClick = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollerRef.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0) return;
    if (el.scrollWidth <= el.clientWidth) return;
    drag.current = { x: e.clientX, start: el.scrollLeft, moved: false, id: e.pointerId };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = scrollerRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return; // still a click
      d.moved = true;
      el.setPointerCapture(d.id);
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
    }
    el.scrollLeft = d.start - dx;
  }

  function endDrag() {
    const d = drag.current;
    const el = scrollerRef.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    el.style.scrollSnapType = "";
    el.style.cursor = "";
    if (el.hasPointerCapture(d.id)) el.releasePointerCapture(d.id);
    // A drag must not also count as a click on the chip under the mouse.
    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, 0);
  }

  function onClickCapture(e: React.MouseEvent) {
    if (!swallowClick.current) return;
    e.preventDefault();
    e.stopPropagation();
    swallowClick.current = false;
  }

  /* ── look ─────────────────────────────────────────────────────── */
  const dark = tone === "dark";
  const buttonCls = dark
    ? "bg-white/20 text-white ring-1 ring-white/25 backdrop-blur"
    : "bg-white text-[#14171C] shadow-[0_2px_10px_rgba(16,24,32,0.16)] ring-1 ring-black/5";

  function edge(side: "left" | "right") {
    const isLeft = side === "left";
    return (
      <div
        key={side}
        className={`pointer-events-none absolute inset-y-0 z-[1] flex w-12 items-center ${
          isLeft ? "left-0 justify-start pl-1" : "right-0 justify-end pr-1"
        }`}
        style={{
          background: `linear-gradient(to ${isLeft ? "right" : "left"}, ${fadeColor} 30%, transparent)`,
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={isLeft ? "Show previous" : "Show more"}
          onClick={() => page(isLeft ? -1 : 1)}
          className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90 ${buttonCls}`}
        >
          {isLeft ? <ChevronLeft size={15} strokeWidth={2.5} /> : <ChevronRight size={15} strokeWidth={2.5} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`relative min-w-0 ${outerClassName}`}>
      <div
        ref={scrollerRef}
        role={ariaLabel ? "group" : undefined}
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className={`overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          snap ? "snap-x scroll-px-4" : ""
        }`}
      >
        <div ref={trackRef} className={`relative flex w-max ${center ? "mx-auto" : ""} ${className}`}>
          {children}
        </div>
      </div>
      {edges.left && edge("left")}
      {edges.right && edge("right")}
    </div>
  );
}