/**
 * Conventional Commits, enforced in CI rather than by a local git hook —
 * nothing slows down your commits, but a malformed message fails the PR check.
 *
 *   feat(checkout): add pincode serviceability check
 *   fix(server): restore stock when an order is cancelled twice
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'shared',
        'server',
        'client',
        'admin',
        'checkout',
        'catalog',
        'orders',
        'ci',
        'deps',
        'docs',
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
};
