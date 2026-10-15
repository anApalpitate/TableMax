function validateVersion(version) {
  if (
    typeof version !== 'string' ||
    !/^1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?$/.test(version) ||
    version.split('.').some((part) => Number(part) > 65534)
  )
    throw new Error('Invalid Windows delivery identity');
}

/** Current complete installer output. Historical formats are explicit below. */
export function windowsExecutableName(version, edition = 'full') {
  validateVersion(version);
  if (edition !== 'full')
    throw new Error(
      'Only the complete installer is a current Windows delivery',
    );
  return `TableMax-${version}-installer-win-x64.exe`;
}

/** Exact historical portable/full/box name; never a new installer output. */
export function legacyWindowsExecutableName(version, edition = 'full') {
  validateVersion(version);
  if (!['full', 'box'].includes(edition))
    throw new Error('Invalid Windows delivery identity');
  return `TableMax-${version}-win-x64${edition === 'box' ? '-box' : ''}.exe`;
}
