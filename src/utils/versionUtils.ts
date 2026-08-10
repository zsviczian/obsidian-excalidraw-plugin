/**
 * Reports whether one semantic-style version is newer than another.
 *
 * @param version - Candidate version containing a `major.minor.patch` sequence.
 * @param otherVersion - Version to compare against.
 * @returns `true` when `version` is newer.
 * @remarks
 * Missing versions intentionally return `true` for backward compatibility.
 * Only the first three numeric components are compared; any surrounding
 * prerelease or build text is ignored.
 */
export function isVersionNewerThanOther(
  version: string,
  otherVersion: string,
): boolean {
  if (!version || !otherVersion) {
    return true;
  }

  const v = version.match(/(\d*)\.(\d*)\.(\d*)/);
  const o = otherVersion.match(/(\d*)\.(\d*)\.(\d*)/);

  return Boolean(
    v &&
    v.length === 4 &&
    o &&
    o.length === 4 &&
    !(
      isNaN(parseInt(v[1])) ||
      isNaN(parseInt(v[2])) ||
      isNaN(parseInt(v[3]))
    ) &&
    !(
      isNaN(parseInt(o[1])) ||
      isNaN(parseInt(o[2])) ||
      isNaN(parseInt(o[3]))
    ) &&
    (parseInt(v[1]) > parseInt(o[1]) ||
      (parseInt(v[1]) >= parseInt(o[1]) && parseInt(v[2]) > parseInt(o[2])) ||
      (parseInt(v[1]) >= parseInt(o[1]) &&
        parseInt(v[2]) >= parseInt(o[2]) &&
        parseInt(v[3]) > parseInt(o[3])))
  );
}
