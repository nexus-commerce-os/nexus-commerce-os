"""services/ai — AI Serving + Agent (Python/FastAPI).

P0.1 SCAFFOLD — intent declaration only. NO endpoints, NO agent loop, NO model calls.

When implemented (P0.5 — AI Foundation) this service will provide:
  * the model-agnostic AI Gateway + router (ADR-0005) with cost cascade <= $0.01/req (ADR-0009)
  * grounded RAG + embedding + recommendation engine
  * agent loop + tool-calling over the single tool-RPC mechanism, with safety gates
  * grounded-only product facts (hallucination < 0.5%, NFR-AI-01); price numbers are
    DETERMINISTICALLY VERIFIED, never LLM-asserted

Boundary rule (do NOT violate when implementing):
  * never call Core modules synchronously on the hot path — read async read-models only (ADR-0020)

This package intentionally contains no logic in the scaffold.
"""

__all__: list[str] = []
