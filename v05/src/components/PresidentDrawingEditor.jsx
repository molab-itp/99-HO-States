import { useEffect, useRef, useState } from 'react';
import NavBar from './NavBar.jsx';
import Icon from './Icon.jsx';
import DrawingOverlay, { strokePath } from './DrawingOverlay.jsx';

// Stand-ins for PKToolPicker's pen colors; the first matches the Swift canvas's default
// `.systemRed` pen. Colors are fixed hex values (not theme tokens) so ink looks the same in light
// and dark mode, like the Swift canvas pinned to `.light`.
const PEN_COLORS = ['#ff3b30', '#34c759', '#ffcc00', '#ffffff', '#000000', '#007aff'];
const PEN_WIDTH_PX = 5; // on-screen width, matches `PKInkingTool(.pen, ..., width: 5)`

function roundTenth(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Port of PresidentDrawingEditorView.swift: the portrait with a drawing surface laid exactly over
 * it. Shown as a full-screen layer on top of `PresidentDetailScreen` rather than pushed onto the
 * navigation stack, since the stack only renders its top entry and a push would unmount the
 * detail screen (losing its slideshow position and history). The drawing is handed back through
 * `onClose` whenever the editor goes away (Done or Back), so there's no way to lose strokes by
 * leaving: `null` means the canvas was left empty (delete the saved drawing), `undefined` means
 * the photo never loaded, so there's nothing to write back.
 */
export default function PresidentDrawingEditor({ president, imageSrc, initialDrawing, onClose }) {
  const [strokes, setStrokes] = useState(() => initialDrawing?.strokes ?? []);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [color, setColor] = useState(PEN_COLORS[0]);
  // The portrait's natural size, which is the coordinate space strokes are stored in. Known up
  // front for an existing drawing, otherwise read from the image once it loads.
  const [imageSize, setImageSize] = useState(() =>
    initialDrawing ? { width: initialDrawing.width, height: initialDrawing.height } : null,
  );
  const surfaceRef = useRef(null);
  const photoRef = useRef(null);
  const strokeRef = useRef(null);

  // iOS WebKit doesn't honor `touch-action` on SVG elements, so a finger drawing on the surface
  // soon turns into a page scroll/zoom gesture, which cancels the pointer and cuts the stroke
  // short. Blocking the photo's native touch events (non-passive, so preventDefault works) keeps
  // the whole touch for drawing; pointer events still arrive.
  useEffect(() => {
    const el = photoRef.current;
    if (!el) return undefined;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('gesturechange', prevent);
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove', prevent);
      el.removeEventListener('gesturestart', prevent);
      el.removeEventListener('gesturechange', prevent);
    };
  }, [imageSrc]);

  function close() {
    if (!imageSize) {
      onClose(undefined);
    } else if (strokes.length === 0) {
      onClose(null);
    } else {
      onClose({ width: imageSize.width, height: imageSize.height, strokes });
    }
  }

  // Converts a pointer position into image pixels. The surface fills the displayed image's box,
  // so this is just a scale by natural size over on-screen size.
  function toImagePoint(e) {
    const rect = surfaceRef.current.getBoundingClientRect();
    const scale = imageSize.width / rect.width;
    return {
      point: [roundTenth((e.clientX - rect.left) * scale), roundTenth((e.clientY - rect.top) * scale)],
      scale,
    };
  }

  function handlePointerDown(e) {
    if (!imageSize || strokeRef.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture isn't required; move/up events on the surface still arrive without it.
    }
    const { point, scale } = toImagePoint(e);
    strokeRef.current = {
      pointerId: e.pointerId,
      stroke: { color, size: roundTenth(PEN_WIDTH_PX * scale), points: [point] },
    };
    setCurrentStroke(strokeRef.current.stroke);
  }

  function handlePointerMove(e) {
    const active = strokeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    const { point } = toImagePoint(e);
    const last = active.stroke.points[active.stroke.points.length - 1];
    if (last[0] === point[0] && last[1] === point[1]) return;
    active.stroke = { ...active.stroke, points: [...active.stroke.points, point] };
    setCurrentStroke(active.stroke);
  }

  function handlePointerUp(e) {
    const active = strokeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;
    strokeRef.current = null;
    setCurrentStroke(null);
    setStrokes((prev) => [...prev, active.stroke]);
  }

  const drawing = imageSize ? { width: imageSize.width, height: imageSize.height, strokes } : null;

  return (
    <div className="drawing-editor" role="dialog" aria-label={`Draw on ${president.name}`}>
      <NavBar
        title={president.name}
        onBack={close}
        trailing={
          <>
            <button
              className="nav-action nav-action-destructive"
              aria-label="Clear"
              disabled={!imageSize || strokes.length === 0}
              onClick={() => setStrokes([])}
            >
              <Icon name="trash" size={18} />
            </button>
            <button className="nav-action nav-action-text" onClick={close}>
              Done
            </button>
          </>
        }
      />

      <div className="drawing-editor-body">
        {imageSrc ? (
          <div className="drawing-editor-photo" ref={photoRef}>
            <img
              src={imageSrc}
              alt={president.name}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onLoad={(e) => {
                if (!imageSize) {
                  setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight });
                }
              }}
            />
            {drawing && (
              <DrawingOverlay
                drawing={drawing}
                className="drawing-surface"
                ref={surfaceRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {currentStroke && (
                  <path
                    d={strokePath(currentStroke.points)}
                    fill="none"
                    stroke={currentStroke.color}
                    strokeWidth={currentStroke.size}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </DrawingOverlay>
            )}
          </div>
        ) : (
          <div className="detail-image-placeholder">
            <Icon name="person-circle" size={64} />
          </div>
        )}
      </div>

      <div className="drawing-tools" aria-label="Pen tools">
        <button
          className="toolbar-btn toolbar-btn-icon"
          aria-label="Undo"
          disabled={strokes.length === 0}
          onClick={() => setStrokes((prev) => prev.slice(0, -1))}
        >
          <Icon name="undo" size={18} />
        </button>
        <div className="pen-colors">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              className={c === color ? 'pen-color selected' : 'pen-color'}
              style={{ background: c }}
              aria-label={`Pen color ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
