/** @param {string} origin @param {string} [name] */
export function buildOtpOptions(origin, name = '') {
  const options = {
    shouldCreateUser: true,
    emailRedirectTo: `${origin}/conta`
  };
  const fullName = typeof name === 'string' ? name.trim() : '';
  if (fullName) options.data = { full_name: fullName };
  return options;
}
