import { useEffect, useRef, useState } from 'react';
import './avatar-upload.css';

export function AvatarUpload({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm(image: string): void;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const image = useRef<HTMLImageElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const selection = useRef(0);
  const [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  const base =
    size.width && size.height
      ? Math.max(256 / size.width, 256 / size.height)
      : 1;
  function clamp(x: number, y: number, factor = zoom) {
    const limitX = Math.max(0, (size.width * base * factor - 256) / 2);
    const limitY = Math.max(0, (size.height * base * factor - 256) / 2);
    return {
      x: Math.max(-limitX, Math.min(limitX, x)),
      y: Math.max(-limitY, Math.min(limitY, y)),
    };
  }
  return (
    <section className="avatar-upload" aria-label="上传头像">
      <label className="avatar-upload__choose">
        <span>上传图片</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const current = ++selection.current;
            setError('');
            if (
              !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
              file.size > 10 * 1024 * 1024
            ) {
              setError('请选择 10 MB 以内的 JPG、PNG 或 WebP 图片。');
              return;
            }
            setLoading(true);
            const url = URL.createObjectURL(file);
            const probe = new Image();
            probe.onload = () => {
              if (current !== selection.current) {
                URL.revokeObjectURL(url);
                return;
              }
              setSize({
                width: probe.naturalWidth,
                height: probe.naturalHeight,
              });
              setOffset({ x: 0, y: 0 });
              setZoom(1);
              setSource(url);
              setLoading(false);
            };
            probe.onerror = () => {
              URL.revokeObjectURL(url);
              if (current === selection.current) {
                setError('这张图片无法读取，请换一张。');
                setLoading(false);
              }
            };
            probe.src = url;
          }}
        />
      </label>
      {loading && <p role="status">正在读取图片…</p>}
      {error && <p role="alert">{error}</p>}
      {source && (
        <div className="avatar-upload__editor">
          <div
            ref={frame}
            className="avatar-upload__frame"
            aria-label="拖动图片调整头像位置"
            onPointerDown={(event) => {
              if (disabled) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                originX: offset.x,
                originY: offset.y,
              };
            }}
            onPointerMove={(event) => {
              if (!drag.current || disabled) return;
              const ratio = 256 / (frame.current?.clientWidth || 256);
              setOffset(
                clamp(
                  drag.current.originX +
                    (event.clientX - drag.current.x) * ratio,
                  drag.current.originY +
                    (event.clientY - drag.current.y) * ratio,
                ),
              );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img
              ref={image}
              src={source}
              alt="头像裁剪预览"
              draggable={false}
              style={{
                width: `${((size.width * base * zoom) / 256) * 100}%`,
                height: `${((size.height * base * zoom) / 256) * 100}%`,
                transform: `translate(calc(-50% + ${(offset.x / 256) * 100}cqw), calc(-50% + ${(offset.y / 256) * 100}cqw))`,
              }}
            />
            <span className="avatar-upload__circle" aria-hidden="true" />
          </div>
          <label className="avatar-upload__zoom">
            缩放
            <input
              aria-label="头像缩放"
              type="range"
              min="1"
              max="4"
              step="0.05"
              value={zoom}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value);
                setZoom(value);
                setOffset(clamp(offset.x, offset.y, value));
              }}
            />
          </label>
          <div className="avatar-upload__position" aria-label="微调位置">
            {(
              [
                ['左', -12, 0],
                ['上', 0, -12],
                ['下', 0, 12],
                ['右', 12, 0],
              ] as const
            ).map(([label, dx, dy]) => (
              <button
                key={label}
                type="button"
                className="secondary"
                aria-label={`头像向${label}移动`}
                disabled={disabled}
                onClick={() => setOffset(clamp(offset.x + dx, offset.y + dy))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="secondary"
              type="button"
              disabled={disabled}
              onClick={() => {
                setSource('');
                setError('');
              }}
            >
              取消裁剪
            </button>
            <button
              type="button"
              disabled={disabled || loading}
              onClick={() => {
                if (!image.current?.complete) return;
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = canvas.height = 256;
                  const context = canvas.getContext('2d');
                  if (!context) throw new Error();
                  context.drawImage(
                    image.current,
                    (256 - size.width * base * zoom) / 2 + offset.x,
                    (256 - size.height * base * zoom) / 2 + offset.y,
                    size.width * base * zoom,
                    size.height * base * zoom,
                  );
                  onConfirm(canvas.toDataURL('image/png').split(',')[1]!);
                } catch {
                  setError('头像裁剪失败，请重新选择图片。');
                }
              }}
            >
              使用这张头像
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
