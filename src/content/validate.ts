import type { BranchDef, Condition, GameContent, WeatherProfile, WeatherVisual } from '@domain/types'
import { GEAR_SLOTS } from '@domain/types'
import { itemZoneMap } from '@domain/zones'
import { BALANCE } from './balance'

/** Boot-time content checks (dev + tests). Returns human-readable errors. */
export function validateContent(content: GameContent): string[] {
  const errors: string[] = []

  if (!(content.currencyItemId in content.items)) {
    errors.push(`currencyItemId "${content.currencyItemId}" is not defined in items`)
  }

  for (const [key, item] of Object.entries(content.items)) {
    if (item.id !== key) {
      errors.push(`item key "${key}" does not match id "${item.id}"`)
    }
    if (item.cap && item.cap.lte(0)) {
      errors.push(`item "${key}" cap must be > 0 (or null/absent for uncapped)`)
    }
    if (item.carry && item.carry.lte(0)) {
      errors.push(`item "${key}" carry must be > 0 (or null/absent for a bag that never limits it)`)
    }
  }

  if (content.simulation && !(content.simulation.offlineChunkSeconds > 0)) {
    errors.push('simulation.offlineChunkSeconds must be > 0')
  }

  for (const [key, zone] of Object.entries(content.zones)) {
    if (zone.id !== key) {
      errors.push(`zone key "${key}" does not match id "${zone.id}"`)
    }
    if (zone.requires) {
      validateCondition(zone.requires, content, `zone "${key}"`, errors)
    }
  }

  for (const [key, branch] of Object.entries(content.branches)) {
    if (branch.id !== key) {
      errors.push(`branch key "${key}" does not match id "${branch.id}"`)
    }
    for (const zoneId of branch.zones ?? []) {
      if (!(zoneId in content.zones)) {
        errors.push(`branch "${key}" lists unknown zone "${zoneId}"`)
      }
    }
    validateBranch(branch, content, errors)
  }

  if (content.milestones) {
    const seen = new Set<string>()
    for (const milestone of content.milestones) {
      if (seen.has(milestone.id)) {
        errors.push(`milestone duplicate id "${milestone.id}"`)
      }
      seen.add(milestone.id)
      validateCondition(milestone.requires, content, `milestone "${milestone.id}"`, errors)
      for (const effect of milestone.reward ?? []) {
        if (effect.target.length === 0) {
          errors.push(`milestone "${milestone.id}" reward effect has an empty target`)
        }
      }
    }
  }

  if (content.weather) {
    validateWeather(content.weather, errors)
  }

  if (content.actions) {
    validateManualActions(content, errors)
  }

  if (content.gear) {
    validateGear(content, errors)
  }

  return errors
}

/**
 * Hand-work jobs. The zone of an action is the yard the player stands in, which
 * must be the yard whose bin the stroke draws from (an item's warehouse follows
 * the worker that consumes it — `domain/zones.ts`); a pure gathering job instead
 * has to produce an item that lives in that same yard, or the two rows of the job
 * would sit in different warehouses.
 */
function validateManualActions(content: GameContent, errors: string[]): void {
  const zones = itemZoneMap(content)
  const seen = new Set<string>()
  for (const action of content.actions ?? []) {
    const where = `action "${action.id}"`
    if (seen.has(action.id)) errors.push(`${where}: duplicate id`)
    seen.add(action.id)
    if (!(action.zone in content.zones)) {
      errors.push(`${where}: unknown zone "${action.zone}"`)
    }
    if (!(action.output.item in content.items)) {
      errors.push(`${where}: outputs unknown item "${action.output.item}"`)
    }
    if (action.output.amount.lte(0)) errors.push(`${where}: output amount must be > 0`)
    if (!(action.workSeconds > 0)) errors.push(`${where}: workSeconds must be > 0`)

    if (action.input) {
      if (!(action.input.item in content.items)) {
        errors.push(`${where}: consumes unknown item "${action.input.item}"`)
      }
      if (action.input.amount.lte(0)) errors.push(`${where}: input amount must be > 0`)
      if (action.input.item === action.output.item) {
        errors.push(`${where}: input and output must differ (same item is a no-op)`)
      }
      const drawn = zones.get(action.input.item)
      if (drawn && drawn !== action.zone) {
        errors.push(`${where}: draws "${action.input.item}" from zone "${drawn}", not "${action.zone}"`)
      }
    } else {
      const produced = zones.get(action.output.item)
      if (produced && produced !== action.zone) {
        errors.push(`${where}: gathers into zone "${produced}", not "${action.zone}"`)
      }
    }

    if (action.requires) {
      validateCondition(action.requires, content, where, errors)
    }
  }
}

/**
 * Gear: money-only purchases the character wears. One piece per slot is a hard
 * rule, because owning a piece IS wearing it (`GameState.gear`) — two pieces in
 * one slot would fight over the body and over the same stat key.
 */
function validateGear(content: GameContent, errors: string[]): void {
  const seen = new Set<string>()
  const slots = new Set<string>()
  for (const piece of content.gear ?? []) {
    const where = `gear "${piece.id}"`
    if (seen.has(piece.id)) errors.push(`${where}: duplicate id`)
    seen.add(piece.id)
    if (!GEAR_SLOTS.includes(piece.slot)) {
      errors.push(`${where}: unknown slot "${piece.slot}"`)
    } else if (slots.has(piece.slot)) {
      errors.push(`${where}: slot "${piece.slot}" already has a piece`)
    } else {
      slots.add(piece.slot)
    }
    if (piece.cost.lte(0)) errors.push(`${where}: cost must be > 0`)
    if (piece.style.length === 0) errors.push(`${where}: style must not be empty`)
    if (piece.effects.length === 0) errors.push(`${where}: has no effects`)
    for (const effect of piece.effects) {
      if (effect.target.length === 0) errors.push(`${where}: effect target must not be empty`)
      if (effect.value.lte(0)) errors.push(`${where}: effect value must be > 0`)
    }
    if (piece.requires) {
      validateCondition(piece.requires, content, where, errors)
    }
  }
}

/** Conditions may only reference ids that exist — a dangling gate would soft-lock content. */
function validateCondition(
  condition: Condition,
  content: GameContent,
  where: string,
  errors: string[],
): void {
  switch (condition.kind) {
    case 'workers': {
      const branch = content.branches[condition.branch]
      if (!branch) {
        errors.push(`${where}: condition references unknown branch "${condition.branch}"`)
        return
      }
      if (!branch.workers.some((worker) => worker.id === condition.worker)) {
        errors.push(
          `${where}: condition references unknown worker "${condition.worker}" in branch "${condition.branch}"`,
        )
      }
      if (!Number.isInteger(condition.count) || condition.count < 1) {
        errors.push(`${where}: condition worker count must be an integer >= 1`)
      }
      break
    }
    case 'upgrade': {
      const branch = content.branches[condition.branch]
      if (!branch) {
        errors.push(`${where}: condition references unknown branch "${condition.branch}"`)
        return
      }
      if (!branch.upgrades.some((upgrade) => upgrade.id === condition.upgrade)) {
        errors.push(
          `${where}: condition references unknown upgrade "${condition.upgrade}" in branch "${condition.branch}"`,
        )
      }
      break
    }
    case 'totalEarned':
      if (condition.amount.lte(0)) {
        errors.push(`${where}: condition amount must be > 0`)
      }
      break
    case 'playTime':
      if (!(condition.seconds > 0)) {
        errors.push(`${where}: condition seconds must be > 0`)
      }
      break
  }
}

function validateWeather(profile: WeatherProfile, errors: string[]): void {
  const where = 'weather'
  if (profile.kinds.length === 0) {
    errors.push(`${where}: needs at least one kind`)
  }
  if (!(profile.blockSeconds > 0)) {
    errors.push(`${where}: blockSeconds must be > 0`)
  } else if (!isMultipleOfTick(profile.blockSeconds)) {
    errors.push(`${where}: blockSeconds must be a multiple of tickSeconds`)
  }
  if (!(profile.transitionSeconds > 0) || profile.transitionSeconds >= profile.blockSeconds) {
    errors.push(`${where}: transitionSeconds must be within (0, blockSeconds)`)
  }

  const seen = new Set<string>()
  for (const kind of profile.kinds) {
    if (seen.has(kind.id)) errors.push(`${where}: duplicate kind id "${kind.id}"`)
    seen.add(kind.id)
    if (!(kind.weight > 0)) errors.push(`${where}: kind "${kind.id}" weight must be > 0`)
    if (!(kind.workMultiplier > 0) || kind.workMultiplier > 2) {
      errors.push(`${where}: kind "${kind.id}" workMultiplier must be within (0, 2]`)
    }
    validateVisual(kind.id, kind.visual, errors)
  }
}

function validateVisual(kindId: string, visual: WeatherVisual, errors: string[]): void {
  const where = `weather kind "${kindId}"`
  const unit = (label: string, value: number): void => {
    if (!(value >= 0) || value > 1) errors.push(`${where}: ${label} must be within [0, 1]`)
  }
  unit('cloudCover', visual.cloudCover)
  unit('rain', visual.rain)
  if (!(visual.wind >= 0) || visual.wind > 2) {
    errors.push(`${where}: wind must be within [0, 2]`)
  }
  if (!(visual.lightning >= 0)) errors.push(`${where}: lightning must be >= 0`)
}

/** true when `seconds` is a whole multiple of the fixed simulation step. */
function isMultipleOfTick(seconds: number): boolean {
  const steps = seconds / BALANCE.tickSeconds
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

function validateBranch(branch: BranchDef, content: GameContent, errors: string[]): void {
  const where = `branch "${branch.id}"`
  if (branch.requires) {
    validateCondition(branch.requires, content, where, errors)
  }
  const seen = new Set<string>()
  const unique = (kind: string, id: string): void => {
    const composite = `${kind}:${id}`
    if (seen.has(composite)) errors.push(`${where}: duplicate ${kind} id "${id}"`)
    seen.add(composite)
  }

  for (const worker of branch.workers) {
    unique('worker', worker.id)
    if (!(worker.output.item in content.items)) {
      errors.push(`${where}: worker "${worker.id}" outputs unknown item "${worker.output.item}"`)
    }
    if (!(worker.visual.zone in content.zones)) {
      errors.push(`${where}: worker "${worker.id}" lives in unknown zone "${worker.visual.zone}"`)
    }
    if (worker.baseCost.lte(0)) errors.push(`${where}: worker "${worker.id}" baseCost must be > 0`)
    if (worker.costGrowth.lt(1)) errors.push(`${where}: worker "${worker.id}" costGrowth must be >= 1`)
    if (worker.output.ratePerUnit.lte(0)) {
      errors.push(`${where}: worker "${worker.id}" ratePerUnit must be > 0`)
    }
    if (worker.input) {
      if (!(worker.input.item in content.items)) {
        errors.push(`${where}: worker "${worker.id}" consumes unknown item "${worker.input.item}"`)
      }
      if (worker.input.ratePerUnit.lte(0)) {
        errors.push(`${where}: worker "${worker.id}" input ratePerUnit must be > 0`)
      }
      if (worker.input.item === worker.output.item) {
        errors.push(`${where}: worker "${worker.id}" input and output must differ (same item is a no-op)`)
      }
    }
    if (worker.requires) {
      validateCondition(worker.requires, content, `${where} worker "${worker.id}"`, errors)
    }
  }

  for (const recipe of branch.recipes) {
    unique('recipe', recipe.id)
    if (!(recipe.input.item in content.items)) {
      errors.push(`${where}: recipe "${recipe.id}" consumes unknown item "${recipe.input.item}"`)
    }
    if (!(recipe.output.item in content.items)) {
      errors.push(`${where}: recipe "${recipe.id}" produces unknown item "${recipe.output.item}"`)
    }
    if (recipe.input.rate !== null && recipe.input.rate.lte(0)) {
      errors.push(`${where}: recipe "${recipe.id}" input rate must be > 0 (or null for unlimited)`)
    }
    if (recipe.output.perInputUnit.lte(0)) {
      errors.push(`${where}: recipe "${recipe.id}" perInputUnit must be > 0`)
    }
  }

  for (const upgrade of branch.upgrades) {
    unique('upgrade', upgrade.id)
    if (upgrade.cost.lte(0)) errors.push(`${where}: upgrade "${upgrade.id}" cost must be > 0`)
    if (upgrade.effects.length === 0) errors.push(`${where}: upgrade "${upgrade.id}" has no effects`)
    if (upgrade.visual) {
      if (!(upgrade.visual.zone in content.zones)) {
        errors.push(`${where}: upgrade "${upgrade.id}" raises unknown zone "${upgrade.visual.zone}"`)
      }
      if (!Number.isInteger(upgrade.visual.tier) || upgrade.visual.tier < 1) {
        errors.push(`${where}: upgrade "${upgrade.id}" visual tier must be an integer >= 1`)
      }
    }
    if (upgrade.requires) {
      validateCondition(upgrade.requires, content, `${where} upgrade "${upgrade.id}"`, errors)
    }
  }
}
