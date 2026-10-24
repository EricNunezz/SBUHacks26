import { useCallback, useEffect, useRef, useState } from "react";

// Drag (and optionally corner-resize) for a panel that floats inside a positioned parent, such as the diagram board.
// The panel is placed with CSS (e.g. absolute right-4 top-4); this hook only adds a translate offset and a size.
// The offset is re-clamped whenever the panel or its parent changes size, so the panel can't end up outside the parent
// when the chat, the sidebar or the window resizes.
export default function useFloatingPanel({ minWidth = 380, minHeight = 200 } = {}) {
  const panelRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(null); // { width, height } once the user has resized
  const offsetRef = useRef(offset); // offset currently applied to the DOM
  const dragStart = useRef(null);
  const resizeStart = useRef(null);

  // Limit an offset so the panel stays fully inside its parent
  const clampOffset = useCallback((next) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return next;
    const p = panel.getBoundingClientRect();
    const b = parent.getBoundingClientRect();
    const cur = offsetRef.current;
    // How far the panel can still move in each direction from where it is now
    const minX = cur.x + (b.left - p.left);
    const maxX = cur.x + (b.right - p.right);
    const minY = cur.y + (b.top - p.top);
    const maxY = cur.y + (b.bottom - p.bottom);
    // If the panel is bigger than the parent, min > max: favor top-left
    return {
      x: Math.max(minX, Math.min(next.x, maxX)),
      y: Math.max(minY, Math.min(next.y, maxY)),
    };
  }, []);

  const applyOffset = useCallback(
    (next) => {
      const clamped = clampOffset(next);
      if (clamped.x === offsetRef.current.x && clamped.y === offsetRef.current.y) return;
      offsetRef.current = clamped;
      setOffset(clamped);
    },
    [clampOffset],
  );

  // Re-clamp when the panel or its parent changes size (collapse/expand, chat or sidebar resize, window resize)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const reclamp = () => applyOffset(offsetRef.current);
    const ro = new ResizeObserver(reclamp);
    ro.observe(panel);
    ro.observe(panel.parentElement);
    window.addEventListener("resize", reclamp);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", reclamp);
    };
  }, [applyOffset]);

  const dragProps = {
    // Mouse/finger goes down on the header: remember where we started
    onPointerDown(e) {
      if (e.target.closest("button, a")) return; // clicking a control shouldn't drag
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, startX: offsetRef.current.x, startY: offsetRef.current.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    // New offset = where we started + how far the pointer moved (clamped)
    onPointerMove(e) {
      if (!dragStart.current) return;
      applyOffset({
        x: dragStart.current.startX + (e.clientX - dragStart.current.mouseX),
        y: dragStart.current.startY + (e.clientY - dragStart.current.mouseY),
      });
    },
    onPointerUp() {
      dragStart.current = null;
    },
  };

  // Bottom-right corner handle. The panel's top-left stays put, so the size is capped at the parent's right/bottom edge.
  const resizeProps = {
    onPointerDown(e) {
      const rect = panelRef.current.getBoundingClientRect();
      resizeStart.current = { x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();
    },
    onPointerMove(e) {
      const start = resizeStart.current;
      if (!start) return;
      const p = panelRef.current.getBoundingClientRect();
      const b = panelRef.current.parentElement.getBoundingClientRect();
      const maxWidth = Math.max(b.right - p.left, 0);
      const maxHeight = Math.max(b.bottom - p.top, 0);
      setSize({
        width: Math.min(Math.max(start.width + (e.clientX - start.x), Math.min(minWidth, maxWidth)), maxWidth),
        height: Math.min(Math.max(start.height + (e.clientY - start.y), Math.min(minHeight, maxHeight)), maxHeight),
      });
    },
    onPointerUp() {
      resizeStart.current = null;
    },
  };

  // Inline style for the panel; the height is only fixed while expanded so a collapsed panel shrinks to its header
  const getStyle = (collapsed = false) => ({
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    ...(size && { width: size.width, ...(collapsed ? {} : { height: size.height }) }),
  });

  return { panelRef, dragProps, resizeProps, getStyle };
}
