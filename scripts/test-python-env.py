"""Simple Python environment sanity test.
Checks importability of core dependencies and required env variables.
Exits non-zero on failure so demo aborts early if environment broken.
"""

import importlib, os, sys

MODULES = [
    "flask",
    "dotenv",
    "boto3",
    "requests",
]

failed = []
for m in MODULES:
    try:
        importlib.import_module(m)
    except Exception as e:
        failed.append((m, str(e)))

if failed:
    print("❌ Import failures:")
    for mod, err in failed:
        print(f"  - {mod}: {err}")
    sys.exit(1)
else:
    print("✅ All Python imports passed")

# Light env variable checks (non-fatal warnings)
required_env = ["FRONTEND_ORIGIN"]
missing = [v for v in required_env if not os.getenv(v)]
if missing:
    print("⚠️ Missing optional env vars:", ", ".join(missing))
else:
    print("✅ Required env variables present")

print("✅ Python environment test complete")