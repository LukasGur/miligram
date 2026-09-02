"""Vypíše ze SPC jen řádky s dávkovacími čísly — hustá fakta bez balastu."""
import re, sys, os
from pypdf import PdfReader
SP = os.path.dirname(os.path.abspath(__file__))
PAT = re.compile(os.environ.get("PAT", r"mg/kg|mcg/kg|µg/kg|mg/m2|mg/m²|ml/h|mmol|IU|j\.?m\.?|ředě|ředí|rozpouštědl|rozpust|koncentrac|mg/ml"), re.I)

for name in sys.argv[1:]:
    r = PdfReader(os.path.join(SP, "spc", name))
    t = "\n".join(p.extract_text() or "" for p in r.pages)
    title = re.search(r"1\.\s*NÁZEV PŘÍPRAVKU\s*\n+(.{0,90})", t)
    print("=" * 88)
    print(name, "|", (title.group(1).strip() if title else "?"))
    s = re.search(r"4\.\s*2\.?\s*Dávkování", t, re.I)
    e = re.search(r"4\.\s*3\.?\s*Kontraindikace", t, re.I)
    body = t[s.start(): e.start()] if s and e and e.start() > s.start() else t
    seen = set()
    for line in body.split("\n"):
        line = " ".join(line.split())
        if len(line) > 8 and PAT.search(line) and line not in seen:
            seen.add(line)
            print("  ", line[:180])
