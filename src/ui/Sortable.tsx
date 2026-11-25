import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { Icon } from './Icon'

/**
 * A vertical list reordered by dragging a grip handle. Uses Pointer Events so
 * it works the same with a mouse, a finger or a pencil (BLUEPRINT §10), and the
 * handle also answers ArrowUp / ArrowDown for keyboards and screen readers.
 *
 * `onMove(from, to)` fires once per completed move; `onDrop` after the parent has re-rendered.
 */
export function SortableList<T extends { id: string }>({
  items,
  onMove,
  onDrop,
  renderItem,
  label,
  className,
}: {
  items: readonly T[]
  onMove: (from: number, to: number) => void
  onDrop?: () => void
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode
  /** Accessible name of each handle, e.g. "Reorder ingredient". */
  label: (item: T, index: number) => string
  className?: string
}) {
  const listRef = useRef<HTMLUListElement>(null)
  // While dragging, rows are only shifted visually. The real reorder happens on
  // release, because moving the captured element in the DOM makes iOS and
  // Chromium cancel the touch.
  const [drag, setDrag] = useState<{ pointerId: number; from: number; over: number; dy: number } | null>(null)
  const geo = useRef<{ startY: number; centers: number[]; shift: number }>({ startY: 0, centers: [], shift: 0 })

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0 || drag) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rects = ([...(listRef.current?.children ?? [])] as HTMLElement[]).map((el) => el.getBoundingClientRect())
    const r = rects[index]
    const next = rects[index + 1] ?? rects[index - 1]
    const gap = next ? Math.abs(next.top - r.top) - r.height : 0
    geo.current = { startY: e.clientY, centers: rects.map((x) => x.top + x.height / 2), shift: r.height + Math.max(0, gap) }
    setDrag({ pointerId: e.pointerId, from: index, over: index, dy: 0 })
  }
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return
    const { startY, centers } = geo.current
    const dy = e.clientY - startY
    const center = centers[drag.from] + dy
    let over = 0
    centers.forEach((c, i) => {
      if (i !== drag.from && c < center) over++
    })
    setDrag({ ...drag, dy, over })
  }
  const end = (commit: boolean) => {
    if (!drag) return
    setDrag(null)
    if (commit && drag.over !== drag.from) {
      onMove(drag.from, drag.over)
      setTimeout(() => onDrop?.(), 0)
    }
  }
  const offset = (i: number) => {
    if (!drag) return 0
    const { from, over, dy } = drag
    if (i === from) return dy
    if (from < over && i > from && i <= over) return -geo.current.shift
    if (over < from && i >= over && i < from) return geo.current.shift
    return 0
  }
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= items.length) return
    e.preventDefault()
    onMove(index, to)
    // Let the parent re-render with the new order before it persists it.
    setTimeout(() => onDrop?.(), 0)
    // Keep focus on the moved item's handle.
    requestAnimationFrame(() => (listRef.current?.children[to]?.querySelector('[data-grip]') as HTMLElement | null)?.focus())
  }

  return (
    <ul ref={listRef} className={className}>
      {items.map((item, i) => {
        const handle = (
          <button
            type="button"
            data-grip
            aria-label={label(item, i)}
            title="Drag to reorder"
            className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-ink-3 hover:bg-paper-2 active:cursor-grabbing"
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <Icon name="grip" strokeWidth={3} />
          </button>
        )
        return (
          <li
            key={item.id}
            style={drag ? { transform: `translateY(${offset(i)}px)` } : undefined}
            className={cx(
              drag && drag.from !== i && 'transition-transform duration-150',
              drag?.from === i && 'relative z-10 rounded-xl bg-surface shadow-card',
            )}
          >
            {renderItem(item, i, handle)}
          </li>
        )
      })}
    </ul>
  )
}

/** Immutable array move. */
export function move<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = [...arr]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}
