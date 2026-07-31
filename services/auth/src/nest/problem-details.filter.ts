import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { toProblemDetail, type ProblemDetail } from './http-error-mapper';
import { ContractViolation } from './openapi/contract';

const PROBLEM_BASE = 'https://docs.nexus.example/problems/';

/**
 * Renders every failure as an RFC 9457 problem detail, per docs/07 §1.
 *
 * Domain failures reach here as {@link DomainFailure}; the mapping itself stays
 * in `http-error-mapper`, which is unit-tested and refuses to guess a status
 * for an unmapped tag. Nothing is re-decided here — this filter only chooses
 * the transport representation.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = describe(exception);
    response.status(problem.status).type('application/problem+json').send(problem);
  }
}

/** A domain failure on its way out through HTTP. */
export class DomainFailure extends Error {
  constructor(public readonly failure: unknown) {
    super('Domain failure');
    this.name = 'DomainFailure';
  }
}

function describe(exception: unknown): ProblemDetail {
  if (exception instanceof DomainFailure) {
    return toProblemDetail(exception.failure);
  }
  if (exception instanceof ContractViolation) {
    return {
      type: `${PROBLEM_BASE}contract-violation`,
      title: exception.problems.join('; '),
      status: 400,
      code: 'ContractViolation',
    };
  }
  // A body that is not JSON at all never reaches the contract validator.
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      type: `${PROBLEM_BASE}${status === 400 ? 'malformed-request' : 'http-error'}`,
      title: status === 400 ? 'The request body could not be read as JSON.' : exception.message,
      status,
      code: status === 400 ? 'MalformedRequest' : 'HttpError',
    };
  }
  return toProblemDetail(exception);
}
