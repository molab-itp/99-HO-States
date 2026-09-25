import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import DrawingOverlay from './DrawingOverlay.jsx';

const MIN_SCALE = 1;
const MAX_SCALE = 30;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MAX_DELAY_MS = 300;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;
const TAP_MAX_MOVEMENT_PX = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Port of ZoomableHeaderImage.swift: the president's portrait, with pinch-to-zoom, pan (once
 * zoomed), and double-tap to toggle between 1x and 2.5x. The caller gives this component a fresh
 * `key={president.order}` each time the president changes, so `scale`/`offset` start fresh from
 * `initialZoom` (this president's persisted zoom state, if any) instead of carrying over the
 * previous president's zoom/pan. `drawing`, when given, is the president's saved drawing, laid
 * over the photo.
 */
export default function ZoomableHeaderImage({ imageSrc, alt, initialZoom, onZoomChange, drawing = null }) {
  const [scale, setScaleState] = useState(initialZoom?.scale ?? MIN_SCALE);
  const [offset, setOffsetState] = useState({
    x: initialZoom?.offsetX ?? 0,
    y: initialZoom?.offsetY ?? 0,
  });
  const [isInteracting, setIsInteracting] = useState(false);

  // Mirror state into refs so gesture handlers (which read/write across many pointer events) can
  // always see the latest committed values, same role as Swift's `lastScale`/`lastOffset`.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null); // { startDistance, startScale } while 2 fingers are down
  const panRef = useRef(null); // { pointerId, startX, startY, startOffsetX, startOffsetY }
  const lastTapRef = useRef(null); // { time, x, y } of the most recent completed tap
  const frameRef = useRef(null);

  // `touch-action: none` (in CSS) keeps the browser from scrolling or page-zooming on a touch
  // that starts on the photo, so our pointer handlers always get the gesture. iOS Safari still
  // fires its own pinch (`gesture*`) events, so block those and stray touchmoves too; these must
  // be native non-passive listeners for preventDefault to take effect.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('gesturechange', prevent);
    return () => {
      el.removeEventListener('touchmove', prevent);
      el.removeEventListener('gesturestart', prevent);
      el.removeEventListener('gesturechange', prevent);
    };
  }, [imageSrc]);

  function setScale(value) {
    scaleRef.current = value;
    setScaleState(value);
  }

  function setOffset(value) {
    offsetRef.current = value;
    setOffsetState(value);
  }

  function resetZoom() {
    setScale(MIN_SCALE);
    setOffset({ x: 0, y: 0 });
  }

  function persistZoom() {
    if (!onZoomChange) return;
    if (scaleRef.current <= MIN_SCALE && offsetRef.current.x === 0 && offsetRef.current.y === 0) {
      onZoomChange(null);
    } else {
      onZoomChange({ scale: scaleRef.current, offsetX: offsetRef.current.x, offsetY: offsetRef.current.y });
    }
  }

  function toggleZoom() {
    if (scaleRef.current > MIN_SCALE) {
      resetZoom();
    } else {
      setScale(DOUBLE_TAP_ZOOM);
    }
    persistZoom();
  }

  function handlePointerDown(e) {
    if (pointersRef.current.size >= 2) return; // ignore a third finger
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some environments (or a pointerId no longer active by the time this runs) reject
      // capture — tracking still works fine via the move/up handlers below without it.
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsInteracting(true);

    if (pointersRef.current.size === 2) {
      panRef.current = null;
      const [p1, p2] = Array.from(pointersRef.current.values());
      pinchRef.current = { startDistance: distance(p1, p2), startScale: scaleRef.current };
    } else {
      pinchRef.current = null;
      panRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: offsetRef.current.x,
        startOffsetY: offsetRef.current.y,
        moved: false,
      };
    }
  }

  function handlePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const newScale = clamp(
        pinchRef.current.startScale * (distance(p1, p2) / pinchRef.current.startDistance),
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(newScale);
    } else if (panRef.current && panRef.current.pointerId === e.pointerId && scaleRef.current > MIN_SCALE) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (Math.abs(dx) > TAP_MAX_MOVEMENT_PX || Math.abs(dy) > TAP_MAX_MOVEMENT_PX) {
        panRef.current.moved = true;
      }
      setOffset({ x: panRef.current.startOffsetX + dx, y: panRef.current.startOffsetY + dy });
    }
  }

  function endPointer(e) {
    const wasPan = panRef.current && panRef.current.pointerId === e.pointerId;
    const tapCandidate = wasPan && !panRef.current.moved;
    pointersRef.current.delete(e.pointerId);

    if (pinchRef.current && pointersRef.current.size < 2) {
      pinchRef.current = null;
      if (scaleRef.current <= MIN_SCALE) {
        resetZoom();
      }
      persistZoom();
    }
    if (wasPan) {
      panRef.current = null;
      persistZoom();
    }

    if (pointersRef.current.size === 0) {
      setIsInteracting(false);
    }

    if (tapCandidate) {
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && now - last.time < DOUBLE_TAP_MAX_DELAY_MS && distance(last, { x: e.clientX, y: e.clientY }) < DOUBLE_TAP_MAX_DISTANCE_PX) {
        lastTapRef.current = null;
        toggleZoom();
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }
  }

  if (!imageSrc) {
    return (
      <div className="detail-image-placeholder">
        <Icon name="person-circle" size={64} />
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className="zoomable-image"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {/* The drawing sits inside the transformed box, so it zooms and pans together with the
          photo, same as the Swift overlay applied before `scaleEffect`/`offset`. */}
      <div
        className="zoomable-content"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: isInteracting ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <img
          className="detail-image"
          src={imageSrc}
          alt={alt}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        />
        {drawing && <DrawingOverlay drawing={drawing} aria-hidden="true" />}
      </div>
    </div>
  );
}
