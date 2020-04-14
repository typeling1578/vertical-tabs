#!/usr/bin/env python3
import json
from pathlib import Path
import sys


CURRENT_DIR = Path(__file__).parents[0].parents[0]
TRANSLATIONS = CURRENT_DIR / "src" / "_locales"


for lang_dir in TRANSLATIONS.iterdir():
    messages = lang_dir / "messages.json"
    translations = json.loads(messages.open().read())

    to_remove = []
    for key, value in translations.items():
        if value["message"] == "":
            to_remove.append(key)
            continue
    for key in to_remove:
        translations.pop(key)

    messages.open("w").write(
        json.dumps(translations, ensure_ascii=False, indent=4) + '\n'
    )
