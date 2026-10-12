// Lets Node's built-in type stripping load the project's modules in tests:
//  - extensionless relative imports resolve to .ts files
//  - the "@/" alias resolves to src/
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) return next(new URL("../src/" + specifier.slice(2) + ".ts", import.meta.url).href, context);
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return next(specifier + ".ts", context);
    throw e;
  }
}
