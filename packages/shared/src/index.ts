// @nexus/shared — framework-agnostic shared types & utilities.

/*
 * CLOUDFLARE ACCESS. Verifying the `Cf-Access-Jwt-Assertion` header rather
 * than reading it, because "it is behind Access" is a statement about one
 * hostname and never about the code.
 */
export {
  AccessKeyStore,
  AccessVerificationError,
  base64UrlToBytes,
  certsUrl,
  expectedIssuer,
  readAccessToken,
  verifyAccessToken,
  type AccessConfig,
  type AccessFailure,
  type AccessIdentity,
  type VerifyOptions,
} from './access-jwt.js'; // .js, because the package is ESM and Node resolves the emitted specifier literally
