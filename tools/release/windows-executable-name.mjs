export function windowsExecutableName(version, edition) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !['full', 'box'].includes(edition))
    throw new Error('Invalid Windows delivery identity');
  return `TableMax-${version}-win-x64${edition === 'box' ? '-box' : ''}.exe`;
}
