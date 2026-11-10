#!/usr/bin/env python3
"""Erzeugt index.html (Deutsch) und en/index.html (Englisch) aus src/index.src.html.

In der Vorlage steht jeder Text als ⟦Deutsch¦English⟧, {{R}} ist der Pfad zum Hauptordner.
Aufruf im Hauptordner:  python3 src/make_pages.py
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "src" / "index.src.html").read_text(encoding="utf-8")
pair = re.compile(r"⟦(.*?)¦(.*?)⟧", re.S)

for lang, out, prefix in (("de", "index.html", ""), ("en", "en/index.html", "../")):
    html = pair.sub(lambda m: m.group(1 if lang == "de" else 2), src).replace("{{R}}", prefix)
    assert "⟦" not in html and "¦" not in html and "⟧" not in html, "Unvollständiges Textpaar in der Vorlage"
    (root / out).write_text(html, encoding="utf-8")
    print(out, len(html))
