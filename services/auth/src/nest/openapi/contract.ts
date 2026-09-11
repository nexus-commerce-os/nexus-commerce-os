import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

/**
 * The OpenAPI document, loaded once and used as the actual validator.
 *
 * ADR-0020's ruling is that the specification is the source of truth and
 * controllers implement it. That is only enforceable if the spec does real
 * work, so request bodies are validated against the very schemas the document
 * declares — a body the contract forbids cannot reach a use case, and a schema
 * change takes effect without touching a controller. Decorators describe
 * nothing here.
 */
export interface OpenApiDocument {
  readonly openapi: string;
  readonly paths: Record<string, Record<string, OperationObject>>;
  readonly components: { readonly schemas: Record<string, unknown> };
}

export interface OperationObject {
  readonly operationId: string;
  readonly requestBody?: {
    readonly content: Record<string, { readonly schema: { readonly $ref?: string } }>;
  };
  readonly responses: Record<string, ResponseObject>;
}

export interface ResponseObject {
  readonly description: string;
  readonly content?: Record<string, { readonly schema: { readonly $ref?: string } }>;
}

const SPEC_ID = 'identity-openapi';
const DOCUMENT_PATH = join(__dirname, '..', '..', '..', 'openapi', 'identity.yaml');

export class ContractViolation extends Error {
  readonly _tag = 'ContractViolation';
  constructor(public readonly problems: readonly string[]) {
    super(`Request does not match the contract: ${problems.join('; ')}`);
    this.name = 'ContractViolation';
  }
}

export class Contract {
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly ajv: Ajv2020;

  constructor(readonly document: OpenApiDocument) {
    // `strict: false` because the root carries OpenAPI keywords (paths, info)
    // that are not JSON Schema; we only ever resolve pointers into it.
    this.ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(this.ajv);
    this.ajv.addSchema(document, SPEC_ID);
  }

  static load(): Contract {
    return new Contract(parse(readFileSync(DOCUMENT_PATH, 'utf8')) as OpenApiDocument);
  }

  /** Every operation the document declares, keyed by operationId. */
  operations(): ReadonlyMap<string, { method: string; path: string; operation: OperationObject }> {
    const found = new Map<string, { method: string; path: string; operation: OperationObject }>();
    for (const [path, methods] of Object.entries(this.document.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        found.set(operation.operationId, { method, path, operation });
      }
    }
    return found;
  }

  /**
   * Validate a request body against the operation's declared schema.
   *
   * Throws {@link ContractViolation}, which the problem-details filter renders
   * as a 400 — the same shape every other failure takes.
   */
  validateRequest<T>(operationId: string, body: unknown): T {
    const validate = this.requestValidator(operationId);
    if (!validate(body)) {
      throw new ContractViolation(describe(validate));
    }
    return body as T;
  }

  /** Used by the conformance test to prove responses match what is published. */
  validateResponse(operationId: string, status: number, body: unknown): readonly string[] {
    const ref = this.responseRef(operationId, status);
    if (ref === null) {
      return body === undefined || body === '' || body === null
        ? []
        : [`${operationId} ${status} declares no body but one was returned`];
    }
    const validate = this.compile(ref);
    return validate(body) ? [] : describe(validate);
  }

  private requestValidator(operationId: string): ValidateFunction {
    const cached = this.validators.get(operationId);
    if (cached !== undefined) {
      return cached;
    }
    const entry = this.operations().get(operationId);
    if (entry === undefined) {
      throw new Error(`Operation "${operationId}" is not declared in the contract`);
    }
    const ref = entry.operation.requestBody?.content['application/json']?.schema.$ref;
    if (ref === undefined) {
      throw new Error(`Operation "${operationId}" declares no JSON request body`);
    }
    const validate = this.compile(ref);
    this.validators.set(operationId, validate);
    return validate;
  }

  private responseRef(operationId: string, status: number): string | null {
    const entry = this.operations().get(operationId);
    if (entry === undefined) {
      throw new Error(`Operation "${operationId}" is not declared in the contract`);
    }
    const response = entry.operation.responses[String(status)];
    if (response === undefined) {
      throw new Error(`Operation "${operationId}" does not declare a ${status} response`);
    }
    return response.content?.['application/json']?.schema.$ref ?? null;
  }

  private compile(ref: string): ValidateFunction {
    const pointer = `${SPEC_ID}${ref}`;
    const validate = this.ajv.getSchema(pointer);
    if (validate === undefined) {
      throw new Error(`Contract reference "${ref}" does not resolve`);
    }
    return validate;
  }
}

function describe(validate: ValidateFunction): readonly string[] {
  return (validate.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`,
  );
}
