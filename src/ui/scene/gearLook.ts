import type { GameContent, GameState } from '@domain/types'
import type { BodyStyle, HatKind } from '@ui/scene/focus/parts'

/**
 * What the character is wearing, as the body builder's style keys: gear the player
 * owns, by slot. Pure mapping from content + state — the scene never decides what
 * gear does, and the modifier pipeline never decides how it looks.
 */
export function gearLook(state: GameState, content: GameContent): BodyStyle {
  const look: { hat?: HatKind; shirt?: string; pants?: string; shoes?: string } = {}
  for (const piece of content.gear ?? []) {
    if (!state.gear[piece.id]) continue
    if (piece.slot === 'hat') look.hat = piece.style as HatKind
    else if (piece.slot === 'shirt') look.shirt = piece.style
    else if (piece.slot === 'pants') look.pants = piece.style
    else if (piece.slot === 'boots') look.shoes = piece.style
  }
  return look
}
