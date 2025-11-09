import importlib, sys
mods = ["flask", "boto3", "requests", "flask_cors"]
missing = []
for m in mods:
    try:
        importlib.import_module(m)
    except Exception as e:
        missing.append((m, str(e)))
if missing:
    print("Missing modules:", missing)
    sys.exit(1)
print("Backend imports OK")
