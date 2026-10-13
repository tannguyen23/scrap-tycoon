import type { BranchDef, GameContent, UpgradeDef, WorkerDef } from './types'

export function findBranch(content: GameContent, branchId: string): BranchDef | undefined {
  return content.branches[branchId]
}

export function findWorker(branch: BranchDef, workerId: string): WorkerDef | undefined {
  return branch.workers.find((worker) => worker.id === workerId)
}

export function findUpgrade(branch: BranchDef, upgradeId: string): UpgradeDef | undefined {
  return branch.upgrades.find((upgrade) => upgrade.id === upgradeId)
}
