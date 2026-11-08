import { useEffect, useRef, useState } from 'react';

const WHOLE = { x: 0, y: 0, width: 1, height: 1 };
/** Smallest crop side, as a fraction of the image's side. */
const MIN_SIDE = 0.1;
/** The touch target around each corner dot, which is also the image's margin. */
const HANDLE_SIZE = 44;

const CORNERS = [
  { name: 'topLeft', isLeft: true, isTop: true },
  { name: 'topRight', isLeft: false, isTop: true },
  { name: 'bottomLeft', isLeft: true, isTop: false },
  { name: 'bottomRight', isLeft: false, isTop: false },
];

const clamp = (value, low, high) => Math.min(Math.max(low, value), high);

/** Full-screen cropper: drag a corner to resize the crop rectangle, drag inside it to move it. */
export default function PhotoCropView({ imageURL, onCancel, onDone }) {
  const [crop, setCrop] = useState(WHOLE);
  /** The image's own pixel size, once it has loaded. */
  const [natural, setNatural] = useState(null);
  /** The room for the image: the stage, less the margin for the corner handles. */
  const [room, setRoom] = useState(null);
  const stage = useRef(null);
  /** The pointer position and crop when the current drag began; movement is measured from them. */
  const dragStart = useRef(null);

  useEffect(() => {
    const measure = () => {
      const { width, height } = stage.current.getBoundingClientRect();
      setRoom({ width: Math.max(1, width - HANDLE_SIZE), height: Math.max(1, height - HANDLE_SIZE) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  // The image scaled to fit the room; unit coordinates scale by this size.
  let size = null;
  if (natural && room) {
    const scale = Math.min(room.width / natural.width, room.height / natural.height);
    size = { width: natural.width * scale, height: natural.height * scale };
  }

  const isWholeImage = crop.width > 0.999 && crop.height > 0.999;

  function move(start, dx, dy) {
    setCrop({
      ...start,
      x: clamp(start.x + dx, 0, 1 - start.width),
      y: clamp(start.y + dy, 0, 1 - start.height),
    });
  }

  function resize(corner, start, dx, dy) {
    let [minX, maxX, minY, maxY] = [start.x, start.x + start.width, start.y, start.y + start.height];
    if (corner.isLeft) minX = Math.min(Math.max(0, minX + dx), maxX - MIN_SIDE);
    else maxX = Math.max(Math.min(1, maxX + dx), minX + MIN_SIDE);
    if (corner.isTop) minY = Math.min(Math.max(0, minY + dy), maxY - MIN_SIDE);
    else maxY = Math.max(Math.min(1, maxY + dy), minY + MIN_SIDE);
    setCrop({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
  }

  /** Pointer handlers that call `update(startCrop, dx, dy)` with the drag's movement in unit coordinates. */
  function drag(update) {
    return {
      onPointerDown(event) {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = { x: event.clientX, y: event.clientY, crop };
      },
      onPointerMove(event) {
        const start = dragStart.current;
        if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        update(start.crop, (event.clientX - start.x) / size.width, (event.clientY - start.y) / size.height);
      },
      onPointerUp() {
        dragStart.current = null;
      },
      onPointerCancel() {
        dragStart.current = null;
      },
    };
  }

  const percent = (value) => `${value * 100}%`;

  return (
    <div className="crop-view" role="dialog" aria-label="Crop Photo">
      <div className="crop-bar">
        <button className="nav-button" onClick={onCancel}>
          Cancel
        </button>
        <span className="nav-title">Crop Photo</span>
        <button className="nav-button nav-button-strong" onClick={() => onDone(isWholeImage ? null : crop)}>
          Done
        </button>
      </div>

      <div className="crop-stage" ref={stage}>
        <div className="crop-image" style={size ?? { visibility: 'hidden' }}>
          <img
            src={imageURL}
            alt=""
            draggable={false}
            onLoad={(event) => setNatural({ width: event.target.naturalWidth, height: event.target.naturalHeight })}
          />
          {size && (
            <>
              {/* Dims everything outside the crop: the rectangle's shadow, clipped to the image. */}
              <div className="crop-dim">
                <div
                  className="crop-rect"
                  style={{
                    left: percent(crop.x),
                    top: percent(crop.y),
                    width: percent(crop.width),
                    height: percent(crop.height),
                  }}
                  {...drag(move)}
                />
              </div>
              {CORNERS.map((corner) => (
                <div
                  key={corner.name}
                  className="crop-handle"
                  data-corner={corner.name}
                  style={{
                    left: percent(corner.isLeft ? crop.x : crop.x + crop.width),
                    top: percent(corner.isTop ? crop.y : crop.y + crop.height),
                  }}
                  {...drag((start, dx, dy) => resize(corner, start, dx, dy))}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="crop-bar">
        <button className="nav-button" disabled={isWholeImage} onClick={() => setCrop(WHOLE)}>
          Reset
        </button>
      </div>
    </div>
  );
}
