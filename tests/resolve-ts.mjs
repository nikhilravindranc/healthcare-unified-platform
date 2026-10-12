// Resolves extensionless relative imports to .ts files so Node's built-in type stripping can load the project's modules.
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) return next(specifier + ".ts", context);
    throw e;
  }
}
