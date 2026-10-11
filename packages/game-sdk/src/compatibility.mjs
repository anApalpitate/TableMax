export const PLATFORM_CAPABILITIES = Object.freeze([
  'concurrent-secret-actions',
  'saved-release-restore',
  'retired-variants',
  'web-details',
]);
export function moduleCompatibilityIssue(
  value,
  capabilities = PLATFORM_CAPABILITIES,
) {
  if (!value) return '游戏包缺少兼容性声明，请更换完整的游戏包。';
  const issues = [];
  for (const [key, label, supported] of [
    ['sdk', 'SDK', [1]],
    ['protocol', '通信协议', [7, 8]],
    ['webHost', '页面接口', [1]],
  ]) {
    const required = value[key];
    if (!Number.isInteger(required) || required < 0)
      return '游戏包的兼容性声明无效，请更换正确的游戏包。';
    if (!supported.includes(required)) {
      const detail = `${label}：游戏包要求 ${required}，盒子支持 ${supported.join('／')}`;
      issues.push(
        required < supported[0]
          ? `游戏包版本落后，使用了盒子已不支持的旧接口（${detail}），请更新游戏包。`
          : `盒子版本落后，尚不支持游戏包要求的接口（${detail}），请更新盒子。`,
      );
    }
  }
  const required = value.requiredCapabilities ?? [];
  if (
    !Array.isArray(required) ||
    new Set(required).size !== required.length ||
    required.some((capability) => typeof capability !== 'string') ||
    (required.length && value.protocol === 7)
  )
    return '游戏包的能力声明无效，请更换正确的游戏包。';
  const missing = required.filter(
    (capability) => !capabilities.includes(capability),
  );
  if (missing.length)
    issues.push(
      `盒子缺少游戏包要求的能力（${missing.join('、')}），请更新到支持这些能力的盒子版本。`,
    );
  return issues.length ? issues.join(' ') : undefined;
}
export function compatibleModule(value, capabilities = PLATFORM_CAPABILITIES) {
  return moduleCompatibilityIssue(value, capabilities) === undefined;
}
export function releaseCompatibilityIssue(release) {
  const issue = moduleCompatibilityIssue(release?.module?.compatibility);
  if (issue || release.variantId === undefined) return issue;
  return moduleCompatibilityIssue(
    release.module.variants?.find((v) => v.id === release.variantId)
      ?.compatibility,
  );
}

export function releaseCompatible(release) {
  return (
    !!release?.module &&
    compatibleModule(release.module.compatibility) &&
    (release.variantId === undefined ||
      compatibleModule(
        release.module.variants?.find((v) => v.id === release.variantId)
          ?.compatibility,
      ))
  );
}
export function preferredCatalogReleases(releases) {
  const selected = new Map();
  for (const release of releases) {
    const key = `${release.gameId}:${release.variantId ?? ''}`;
    const previous = selected.get(key);
    if (
      !previous ||
      (previous.module &&
        !releaseCompatible(previous) &&
        release.module &&
        releaseCompatible(release))
    )
      selected.set(key, release);
  }
  return [...selected.values()];
}
