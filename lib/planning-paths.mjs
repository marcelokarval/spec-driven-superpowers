// Contract paths are exact, portable, repository-relative file names, never globs.
export function safePath(value) {
  return typeof value === 'string' && value.length > 0 &&
    !/[\\:*?"<>|[\]\x00-\x1f]/.test(value) &&
    !value.split('/').some(part => !part || part === '.' || part === '..' ||
      /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part));
}
