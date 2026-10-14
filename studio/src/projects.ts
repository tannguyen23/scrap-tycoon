import { SCRAP_STUDIO_PROJECT } from '@projects/scrapYard/studio'
import type { StudioProject } from './types'

/**
 * Hub registry: every project the studio can open. A project module adapts that
 * project to the studio (its previews and tabs) and may import the project's own
 * modules — the studio itself may not. Adding a project = one module + one line
 * here.
 */
export const STUDIO_PROJECTS: readonly StudioProject[] = [SCRAP_STUDIO_PROJECT]
