#!/usr/bin/env python3
"""Architecture fitness function: migrations must not cross a context boundary.

docs/06 section 4 makes each bounded context live in its own Postgres schema
under its own DB role, and requires CI to grep migrations for cross-schema DDL
so the rule is enforced mechanically rather than by review.

A service's migrations may touch only its own schema. The mapping is derived
from the path -- services/<name>/migrations/*.sql owns schema <name> -- with an
explicit alias table for the cases where the service and schema names differ.

Zero dependencies, mirroring scripts/doc_consistency_lint.py.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# service directory name -> schema it is allowed to own
SCHEMA_ALIASES = {
    "auth": "identity",
}

# Schemas every migration may reference; these are Postgres' own.
ALWAYS_ALLOWED = {"pg_catalog", "information_schema", "public"}

# `CREATE TABLE identity.foo`, `ALTER TABLE ledger.bar`, `CREATE INDEX ... ON x.y`
QUALIFIED_DDL = re.compile(
    r"\b(?:CREATE|ALTER|DROP)\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|VIEW|SEQUENCE|TYPE|FUNCTION|TRIGGER|SCHEMA)"
    r"(?:\s+IF\s+(?:NOT\s+)?EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\.",
    re.IGNORECASE,
)
CREATE_SCHEMA = re.compile(
    r"\bCREATE\s+SCHEMA(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)",
    re.IGNORECASE,
)
# `REFERENCES other.table`, `ON other.table`
QUALIFIED_REF = re.compile(
    r"\b(?:REFERENCES|JOIN|FROM|INTO|UPDATE)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\.",
    re.IGNORECASE,
)


def strip_comments(sql: str) -> str:
    sql = re.sub(r"--[^\n]*", "", sql)
    return re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)


def owned_schema(service_dir: Path) -> str:
    name = service_dir.name
    return SCHEMA_ALIASES.get(name, name)


def check_file(path: Path, allowed: str) -> list[str]:
    sql = strip_comments(path.read_text(encoding="utf-8"))
    problems: list[str] = []
    seen: set[tuple[str, str]] = set()

    for pattern, label in (
        (QUALIFIED_DDL, "DDL on"),
        (CREATE_SCHEMA, "CREATE SCHEMA"),
        (QUALIFIED_REF, "reference to"),
    ):
        for match in pattern.finditer(sql):
            schema = match.group(1).lower()
            if schema == allowed or schema in ALWAYS_ALLOWED:
                continue
            key = (label, schema)
            if key in seen:
                continue
            seen.add(key)
            problems.append(
                f"{path.relative_to(REPO_ROOT).as_posix()}: {label} foreign schema "
                f"'{schema}' (this service owns '{allowed}' only)"
            )
    return problems


def main() -> int:
    problems: list[str] = []
    checked = 0

    for migrations_dir in sorted(REPO_ROOT.glob("services/*/migrations")):
        allowed = owned_schema(migrations_dir.parent)
        for sql_file in sorted(migrations_dir.glob("*.sql")):
            checked += 1
            problems.extend(check_file(sql_file, allowed))

    if problems:
        print("Migration boundary violations:")
        for problem in problems:
            print(f"  - {problem}")
        print(
            "\nEach context owns one schema (docs/06 section 4). Cross-context data "
            "is reached through its API or a domain event, never through SQL."
        )
        return 1

    print(f"Migration boundary lint: OK ({checked} file(s) checked)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
