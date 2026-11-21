#!/usr/bin/env python3
"""Erzeugt index.html/partner.html (Deutsch) und en/… (Englisch) aus den Vorlagen in src/.

In der Vorlage steht jeder Text als ⟦Deutsch¦English⟧, {{R}} ist der Pfad zum Hauptordner.
Aufruf im Hauptordner:  python3 src/make_pages.py
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
pair = re.compile(r"⟦(.*?)¦(.*?)⟧", re.S)

# Vorlage -> deutsche Seite, englische Seite (en/)
for name in ("index", "partner"):
    src = (root / "src" / f"{name}.src.html").read_text(encoding="utf-8")
    for lang, out, prefix in (("de", f"{name}.html", ""), ("en", f"en/{name}.html", "../")):
        html = pair.sub(lambda m: m.group(1 if lang == "de" else 2), src).replace("{{R}}", prefix)
        assert "⟦" not in html and "¦" not in html and "⟧" not in html, f"Unvollständiges Textpaar in {name}"
        (root / out).write_text(html, encoding="utf-8")
        print(out, len(html))
