const clone = (value) => structuredClone(value);

/** Explicit allowlist: detail or private/runtime fields cannot leak by spread. */
export function projectGameCatalog(module, cover = module.cover) {
  const retired = module.retiredVariantIds;
  if (
    retired !== undefined &&
    (!Array.isArray(retired) ||
      new Set(retired).size !== retired.length ||
      retired.some(
        (id) => typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id),
      ) ||
      retired.includes(module.defaultVariantId) ||
      module.variants?.some((v) => retired.includes(v.id)))
  )
    throw new Error('invalid-retired-variants');
  const { id, name, min, max } = module.catalog;
  return {
    id: module.id,
    order: module.order,
    internal: module.internal,
    ...(module.development === undefined
      ? {}
      : { development: module.development }),
    ...(module.library
      ? {
          library: {
            ...(module.library.displayName === undefined
              ? {}
              : { displayName: module.library.displayName }),
            tags: [...module.library.tags],
            ...(module.library.searchTerms === undefined
              ? {}
              : { searchTerms: [...module.library.searchTerms] }),
          },
        }
      : {}),
    catalog: { id, name, min, max },
    cover,
    ...(retired === undefined ? {} : { retiredVariantIds: [...retired] }),
    ...(module.defaultVariantId === undefined
      ? {}
      : { defaultVariantId: module.defaultVariantId }),
    ...(module.variants === undefined
      ? {}
      : {
          variants: module.variants.map(({ id, name, description }) => ({
            id,
            name,
            description,
          })),
        }),
  };
}

export function projectGameDetails(module) {
  const variants = (module.variants ?? [])
    .filter((variant) => variant.introduction !== undefined)
    .map(({ id, introduction }) => ({ id, introduction: clone(introduction) }));
  return {
    schemaVersion: 1,
    id: module.id,
    ...(module.introduction === undefined
      ? {}
      : { introduction: clone(module.introduction) }),
    ...(module.botIntroduction === undefined
      ? {}
      : { botIntroduction: clone(module.botIntroduction) }),
    ...(module.guidance === undefined ? {} : { guidance: module.guidance }),
    ...(variants.length ? { variants } : {}),
  };
}

export function projectGameRuntime(module, overrides = {}) {
  const catalog = projectGameCatalog(
    module,
    overrides.cover === undefined ? module.cover : overrides.cover,
  );
  return {
    schemaVersion: module.schemaVersion,
    ...catalog,
    // decisionTimer is a rules capability, not a library browsing field.
    catalog: clone(module.catalog),
    compatibility: clone(module.compatibility),
    entries: clone(overrides.entries ?? module.entries),
    budgets: clone(module.budgets),
    ...(module.variants === undefined
      ? {}
      : {
          variants: module.variants.map(
            ({ id, name, description, compatibility }) => ({
              id,
              name,
              description,
              compatibility: clone(compatibility),
            }),
          ),
        }),
    ...((overrides.details ?? module.details) === undefined
      ? {}
      : { details: overrides.details ?? module.details }),
    ...((overrides.styles ?? module.styles) === undefined
      ? {}
      : { styles: [...(overrides.styles ?? module.styles)] }),
  };
}

export function projectGameWeb(module) {
  return {
    id: module.id,
    compatibility: { webHost: module.compatibility.webHost },
    entries: { web: module.entries.web },
    styles: [...(module.styles ?? [])],
  };
}
