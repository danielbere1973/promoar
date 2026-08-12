'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type PickerProps = {
  names: string[]
  hasMotion: boolean[]
  onChange: (index: number, remountKey: number) => void
  position?: 'top' | 'bottom'
}

export function Picker({ names, hasMotion, onChange, position = 'bottom' }: PickerProps) {
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const [remountKey, setRemountKey] = useState(0)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const highlightRef = useRef<HTMLSpanElement>(null)

  const moveHighlight = () => {
    const el = itemRefs.current[current]
    const highlight = highlightRef.current
    if (!el || !highlight) return
    highlight.style.width = el.offsetWidth + 'px'
    highlight.style.transform = `translateX(${el.offsetLeft}px)`
  }

  useLayoutEffect(() => {
    moveHighlight()
  }, [current])

  useEffect(() => {
    const url = new URL(window.location.href)
    const v = parseInt(url.searchParams.get('v') || '1', 10) - 1
    const initial = v >= 0 && v < names.length ? v : 0
    setCurrent(initial)
    onChange(initial, 0)

    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))

    const onResize = () => moveHighlight()
    window.addEventListener('resize', onResize)

    const onKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= names.length) setActive(num - 1)
      else if (e.key === 'ArrowRight') setActive((current + 1) % names.length)
      else if (e.key === 'ArrowLeft') setActive((current - 1 + names.length) % names.length)
      else if (e.key === 'r' || e.key === 'R') replay()
    }
    window.addEventListener('keydown', onKeydown)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeydown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActive = (i: number) => {
    if (i < 0 || i >= names.length) return
    setCurrent(i)
    setRemountKey((k) => k + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(i + 1))
    window.history.replaceState(null, '', url.toString())
    onChange(i, remountKey + 1)
  }

  const replay = () => {
    setRemountKey((k) => k + 1)
    onChange(current, remountKey + 1)
  }

  const showReplay = hasMotion.some(Boolean)

  return (
    <nav
      className="proto-picker"
      aria-label="Prototype variants"
      data-ready={ready ? '' : undefined}
      data-position={position === 'top' ? 'top' : undefined}
    >
      <span className="proto-picker-highlight" ref={highlightRef} aria-hidden="true" />
      {names.map((name, i) => (
        <button
          key={name}
          ref={(el) => { itemRefs.current[i] = el }}
          className="proto-picker-item"
          data-active={i === current ? '' : undefined}
          aria-current={i === current ? 'true' : undefined}
          onClick={() => setActive(i)}
        >
          {name}
        </button>
      ))}
      {showReplay && (
        <>
          <span className="proto-picker-divider" aria-hidden="true" />
          <button
            className="proto-picker-item proto-picker-replay"
            aria-label="Replay animation (R)"
            onClick={replay}
          >
            ↻
          </button>
        </>
      )}
    </nav>
  )
}
