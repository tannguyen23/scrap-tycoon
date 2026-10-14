/**
 * Layer rules:
 *   core      -> (nothing inside the repo)
 *   ground    -> core, ui, i18n        (the tile kit; `ground/core` is self-contained,
 *                                       `ground/packs/*` bind the kit to a project)
 *   i18n      -> core
 *   domain    -> core, i18n
 *   content   -> domain, i18n, core
 *   platform  -> core
 *   ui        -> core, ground, scenery, domain, i18n   (must NOT import content or app)
 *   projects  -> ui + kits + studio framework          (studio adapters, one folder per project)
 *   studio    -> kits + project adapters               (must NOT import a project's ui modules)
 *   app       -> everything
 *
 * Content is injected into the UI through React context from app; only app + tests import @content.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies break the layer architecture',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-self-contained',
      severity: 'error',
      comment: 'core is the game-agnostic engine and must not import any other layer',
      from: { path: '^src/core/' },
      to: { pathNot: '^src/core/' },
    },
    {
      name: 'i18n-imports-core-only',
      severity: 'error',
      from: { path: '^src/i18n/' },
      to: { pathNot: '^src/(i18n|core)/' },
    },
    {
      name: 'domain-imports-core-and-i18n',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { pathNot: '^src/(domain|core|i18n)/' },
    },
    {
      name: 'content-imports-domain',
      severity: 'error',
      from: { path: '^src/content/' },
      to: { pathNot: '^src/(content|domain|i18n|core)/' },
    },
    {
      name: 'platform-imports-core',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { pathNot: '^src/(platform|core)/' },
    },
    {
      name: 'ground-core-is-self-contained',
      severity: 'error',
      comment: 'the tile kit engine must not import a pack, the game or any other layer — that is what makes it liftable',
      from: { path: '^src/ground/core/' },
      to: { pathNot: '^src/ground/core/' },
    },
    {
      name: 'ground-packs-bind-core-to-a-project',
      severity: 'error',
      comment: 'a pack may use the kit and its own project, nothing else',
      from: { path: '^src/ground/packs/' },
      to: { pathNot: '^src/(ground|scenery|ui|core|domain|i18n)/' },
    },
    {
      name: 'scenery-core-is-self-contained',
      severity: 'error',
      comment: 'the scenery kit engine must not import a pack, the game or any other layer',
      from: { path: '^src/scenery/core/' },
      to: { pathNot: '^src/scenery/core/' },
    },
    {
      name: 'scenery-packs-bind-core-to-a-project',
      severity: 'error',
      comment: 'a scenery pack may use the kits and its own project, nothing else',
      from: { path: '^src/scenery/packs/' },
      to: { pathNot: '^src/(scenery|ground|ui|core|domain|i18n)/' },
    },
    {
      name: 'ui-does-not-import-content-or-app',
      severity: 'error',
      comment: 'content is injected via context from app; ui must stay a pure consumer',
      from: { path: '^src/ui/' },
      to: { pathNot: '^src/(ui|ground|scenery|core|domain|i18n)/' },
    },
    {
      name: 'no-ui-deps-in-pure-layers',
      severity: 'error',
      comment: 'core/domain/i18n/content must stay free of react and pixi',
      from: { path: '^src/(core|domain|i18n|content)/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
        path: '^(react|react-dom|pixi\\.js)',
      },
    },
    {
      name: 'studio-is-project-agnostic',
      severity: 'error',
      comment: 'the studio is a multi-project hub: it reads the kits and project adapters, never a project module directly',
      from: { path: '^studio/src/' },
      to: { pathNot: '^(studio|src/(core|domain|i18n|ground|scenery|projects))/' },
    },
    {
      name: 'projects-bind-a-project-to-the-studio',
      severity: 'error',
      comment: 'a project adapter may import the game UI, the kits, core and the studio framework, but nothing app-level',
      from: { path: '^src/projects/' },
      to: { pathNot: '^(studio|src/(projects|ui|ground|scenery|core|domain|i18n))/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.app.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}
