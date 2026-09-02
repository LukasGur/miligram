"""Vypíše libovolný oddíl SPC (výchozí 6.6 — pokyny k rekonstituci)."""
import re, sys, os
from pypdf import PdfReader
SP = os.path.dirname(os.path.abspath(__file__))
START = os.environ.get("START", r"6\.\s*6\.?\s")
END = os.environ.get("END", r"7\.\s*DRŽITEL")
LIMIT = int(os.environ.get("LIMIT", "1800"))

for name in sys.argv[1:]:
    r = PdfReader(os.path.join(SP, "spc", name))
    t = "\n".join(p.extract_text() or "" for p in r.pages)
    title = re.search(r"1\.\s*NÁZEV PŘÍPRAVKU\s*\n+(.{0,90})", t)
    print("=" * 88)
    print(name, "|", (title.group(1).strip() if title else "?"))
    matches = list(re.finditer(START, t, re.I))
    s = matches[-1] if matches else None
    e = re.search(END, t[s.end():], re.I) if s else None
    body = t[s.start(): s.end() + (e.start() if e else LIMIT)] if s else "NENALEZENO"
    body = re.sub(r"\n\s*(Strana )?\d+\s*(/|\(celkem)\s*\d+\)?\s*\n", "\n", body)
    body = re.sub(r"[ \t]+", " ", body)
    body = re.sub(r"\n{2,}", "\n", body)
    print(body[:LIMIT])
