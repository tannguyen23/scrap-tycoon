import type { BranchDef, GameContent } from '@domain/types'

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
  }

  for (const [key, zone] of Object.entries(content.zones)) {
    if (zone.id !== key) {
      errors.push(`zone key "${key}" does not match id "${zone.id}"`)
    }
  }

  for (const [key, branch] of Object.entries(content.branches)) {
    if (branch.id !== key) {
      errors.push(`branch key "${key}" does not match id "${branch.id}"`)
    }
    validateBranch(branch, content, errors)
  }

  return errors
}

function validateBranch(branch: BranchDef, content: GameContent, errors: string[]): void {
  const where = `branch "${branch.id}"`
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
  }
}
