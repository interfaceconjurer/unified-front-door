/** @param {Record<string, string | undefined>} env */
function authConfiguration(env) {
  const user = env.BASIC_AUTH_USER ?? "guest", password = env.BASIC_AUTH_PASSWORD;
  if (!user.trim() || user.includes(":") || /[\r\n]/.test(user) || !password?.trim() || /[\r\n]/.test(password)) throw new Error("Invalid Basic Auth configuration");
  return { user, password };
}

/** @param {string | undefined} header @param {{user:string,password:string}} expected */
function authorized(header, expected) {
  const [scheme, encoded] = (header ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return false;
  let decoded;
  try { decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0))); } catch { return false; }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const equal = (actual, wanted) => {
    const encoder = new TextEncoder(), left = encoder.encode(actual), right = encoder.encode(wanted);
    let difference = left.length ^ right.length;
    for (let i = 0; i < left.length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
    return difference === 0;
  };
  const user = equal(decoded.slice(0, sep), expected.user);
  const password = equal(decoded.slice(sep + 1), expected.password);
  return user && password;
}

module.exports = { authConfiguration, authorized };
