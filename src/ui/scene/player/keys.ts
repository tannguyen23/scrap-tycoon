/**
 * Movement keys, tracked in a plain set — never React state. The scene reads it
 * once per frame, so a `setState` here would re-render the whole sidebar for
 * every key press (the same reason the minimap keeps the view in a ref).
 *
 * Listens on `window` like the HUD's `M` shortcut: the canvas never takes focus,
 * so a canvas-scoped listener would silently stop working after any HUD click.
 */

const TRACKED = new Set([
  'w',
  'a',
  's',
  'd',
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',
  'shift',
])

export interface MoveKeys {
  readonly pressed: ReadonlySet<string>
  /** Drop every held key — used when a full-screen HUD panel freezes the walker. */
  clear(): void
  dispose(): void
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function normalize(key: string): string {
  return key.toLowerCase()
}

export function installMoveKeys(): MoveKeys {
  const pressed = new Set<string>()

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isTypingTarget(event.target)) return
    const key = normalize(event.key)
    if (!TRACKED.has(key)) return
    pressed.add(key)
    // Arrows scroll the page behind the game; the key is ours while it is down.
    if (key.startsWith('arrow')) event.preventDefault()
  }

  const onKeyUp = (event: KeyboardEvent): void => {
    pressed.delete(normalize(event.key))
  }

  // Alt-tabbing away while holding a key must not leave the walker running.
  const onBlur = (): void => pressed.clear()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  return {
    pressed,
    clear: () => pressed.clear(),
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      pressed.clear()
    },
  }
}

/** Unit direction from the pressed keys; diagonals are normalised so a walk is not faster. */
export function moveVector(pressed: ReadonlySet<string>): { x: number; y: number } {
  let x = 0
  let y = 0
  if (pressed.has('a') || pressed.has('arrowleft')) x -= 1
  if (pressed.has('d') || pressed.has('arrowright')) x += 1
  if (pressed.has('w') || pressed.has('arrowup')) y -= 1
  if (pressed.has('s') || pressed.has('arrowdown')) y += 1
  const length = Math.hypot(x, y)
  if (length > 1) {
    x /= length
    y /= length
  }
  return { x, y }
}

export function isSprinting(pressed: ReadonlySet<string>): boolean {
  return pressed.has('shift')
}
