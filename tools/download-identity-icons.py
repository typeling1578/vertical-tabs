#!/usr/bin/env python3
from pathlib import Path
from urllib import request


BASE_URL = "https://hg.mozilla.org/mozilla-central/raw-file/tip/browser/components/contextualidentity/content/"
OUTPUT_DIR = Path(__file__).parents[0] / "icons"


response = request.urlopen(BASE_URL)
content = response.read().decode("utf-8").strip()
filenames = [
    line.rpartition(" ")[2] for line in content.split("\n") if line.endswith(".svg")
]
print("Icons found: {}".format(", ".join(filenames)))

OUTPUT_DIR.mkdir(exist_ok=True)
for filename in filenames:
    print("Fetching {}…".format(filename))
    response = request.urlopen(BASE_URL + filename)
    (OUTPUT_DIR / filename).open(mode="w").write(response.read().decode("utf-8"))
