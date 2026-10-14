import '@ui/theme.css'
import { createElement } from 'react'
import type { StudioProject, StudioTab } from '@studio/types'
import { installCursor } from '@ui/cursor'
import { installAudioUnlock } from '@ui/sound/player'
import {
  CharactersTab,
  DecorTab,
  LayoutTab,
  LightingTab,
  PropsTab,
  RulesTab,
  SoundsTab,
  WeatherTab,
  ZonesTab,
} from './tabs'

/** Tabs this project adds on top of the kit's own tabs. */
const ZONE_TABS: readonly StudioTab[] = [
  { id: 'rules', label: 'Luật hình', render: () => createElement(RulesTab) },
  { id: 'decor', label: 'Decor', render: () => createElement(DecorTab) },
  { id: 'characters', label: 'Nhân vật', render: () => createElement(CharactersTab) },
  { id: 'props', label: 'Props & xe', render: () => createElement(PropsTab) },
  { id: 'zones', label: 'Khu', render: () => createElement(ZonesTab) },
  { id: 'layout', label: 'Sơ đồ & nối khu', render: () => createElement(LayoutTab) },
  { id: 'lighting', label: 'Ánh sáng', render: () => createElement(LightingTab) },
  { id: 'weather', label: 'Thời tiết', render: () => createElement(WeatherTab) },
  { id: 'sounds', label: 'Âm thanh', render: () => createElement(SoundsTab) },
]

/**
 * Studio adapter for this project. The tabs and previews that need the game's own
 * modules live in `./tabs` and `./previews`, so the studio itself never imports
 * `@ui` (dependency rule), and chrome (theme, cursor, audio unlock) comes from the
 * project the studio boots in. Adding a project = one folder like this + one line
 * in `studio/src/projects.ts`.
 */
export const SCRAP_STUDIO_PROJECT: StudioProject = {
  id: 'scrapYard',
  label: 'Scrap Tycoon',
  installChrome: () => {
    installAudioUnlock()
    installCursor()
  },
  tabs: ZONE_TABS,
}
