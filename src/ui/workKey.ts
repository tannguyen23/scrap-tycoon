/**
 * The key that starts and holds a manual action. It sits on its own — outside the
 * HUD — because the scene-feed builder names it too (the "pick up" sign hangs at
 * the scrap itself, see `ui/scene/focus/pickTag.ts`), and a feed must not reach
 * into a React component to learn a keystroke.
 */
export const WORK_KEY = 'F'
