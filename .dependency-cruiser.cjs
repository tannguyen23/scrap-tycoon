/**
 * Layer rules:
 *   core      -> (nothing inside the repo)
 *   i18n      -> core
 *   domain    -> core, i18n
 *   content   -> domain, i18n, core
 *   platform  -> core
 *   ui        -> core, domain, i18n   (must NOT import content or app)
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
      name: 'ui-does-not-import-content-or-app',
      severity: 'error',
      comment: 'content is injected via context from app; ui must stay a pure consumer',
      from: { path: '^src/ui/' },
      to: { pathNot: '^src/(ui|core|domain|i18n)/' },
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
