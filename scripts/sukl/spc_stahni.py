"""Vytáhne jednotlivé soubory z 2,6GB SPC archivu SÚKL bez jeho stažení.
Používá HTTP Range: přečte centrální adresář a pak jen požadované členy."""
import io, json, os, struct, sys, urllib.request, zlib

URL = "https://opendata.sukl.cz/soubory/SOD20260827/SPC20260827.zip"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "spc_index.json")


def fetch(start, end):
    req = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def size():
    req = urllib.request.Request(URL, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as r:
        return int(r.headers["Content-Length"])


def build_index():
    total = size()
    tail = fetch(total - 65600, total - 1)
    i = tail.rfind(b"PK\x05\x06")
    n_entries, cd_size, cd_off = struct.unpack("<H", tail[i+10:i+12])[0], \
        struct.unpack("<I", tail[i+12:i+16])[0], struct.unpack("<I", tail[i+16:i+20])[0]
    # ZIP64, pokud klasická hlavička hlásí saturované hodnoty
    j = tail.rfind(b"PK\x06\x06")
    if j != -1:
        n_entries = struct.unpack("<Q", tail[j+32:j+40])[0]
        cd_size = struct.unpack("<Q", tail[j+40:j+48])[0]
        cd_off = struct.unpack("<Q", tail[j+48:j+56])[0]
    cd = fetch(cd_off, cd_off + cd_size - 1)

    index, p = {}, 0
    for _ in range(n_entries):
        if cd[p:p+4] != b"PK\x01\x02":
            break
        method = struct.unpack("<H", cd[p+10:p+12])[0]
        comp = struct.unpack("<I", cd[p+20:p+24])[0]
        uncomp = struct.unpack("<I", cd[p+24:p+28])[0]
        n_len, e_len, c_len = struct.unpack("<HHH", cd[p+28:p+34])
        local = struct.unpack("<I", cd[p+42:p+46])[0]
        name = cd[p+46:p+46+n_len].decode("cp437")
        extra = cd[p+46+n_len:p+46+n_len+e_len]
        # ZIP64 rozšíření přepisuje saturované hodnoty
        if 0xFFFFFFFF in (comp, uncomp, local):
            q = 0
            while q + 4 <= len(extra):
                hid, hsz = struct.unpack("<HH", extra[q:q+4])
                if hid == 0x0001:
                    vals, r = [], q + 4
                    for _ in range(hsz // 8):
                        vals.append(struct.unpack("<Q", extra[r:r+8])[0]); r += 8
                    it = iter(vals)
                    if uncomp == 0xFFFFFFFF: uncomp = next(it)
                    if comp == 0xFFFFFFFF: comp = next(it)
                    if local == 0xFFFFFFFF: local = next(it)
                q += 4 + hsz
        index[name] = [local, comp, method]
        p += 46 + n_len + e_len + c_len
    json.dump(index, open(CACHE, "w"))
    return index


def load_index():
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    return build_index()


def extract(name, index=None):
    index = index or load_index()
    local, comp, method = index[name]
    head = fetch(local, local + 29)
    n_len, e_len = struct.unpack("<HH", head[26:30])
    start = local + 30 + n_len + e_len
    raw = fetch(start, start + comp - 1)
    return zlib.decompress(raw, -15) if method == 8 else raw


if __name__ == "__main__":
    idx = load_index()
    print(f"{len(idx)} souborů v archivu")
    for name in sys.argv[1:]:
        match = next((k for k in idx if k.endswith(name)), None)
        if not match:
            print(f"  {name}: nenalezeno"); continue
        data = extract(match, idx)
        out = os.path.join(HERE, "spc", name)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "wb").write(data)
        print(f"  {match} -> {len(data)} B")
