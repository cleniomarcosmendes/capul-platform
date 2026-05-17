#!/usr/bin/env python3
# PoC CNPJ/RFB — stream 1 partição Estabelecimentos (zip) -> CSV essencial p/ \copy
import sys, zipfile, csv, io
src = sys.argv[1]
z = zipfile.ZipFile(src)
# membro da RFB não tem extensão .csv; pega o maior (ou contendo ESTABELE)
members = sorted(z.infolist(), key=lambda m: m.file_size, reverse=True)
member = next((m for m in members if 'ESTABELE' in m.filename.upper()), members[0])
out = csv.writer(sys.stdout)
n = skip = 0
with z.open(member) as fh:
    txt = io.TextIOWrapper(fh, encoding='latin-1', newline='')
    r = csv.reader(txt, delimiter=';', quotechar='"')
    for row in r:
        if len(row) < 28:
            skip += 1
            continue
        out.writerow([
            row[0] + row[1] + row[2],  # cnpj_completo
            row[0], row[1], row[2], row[3], row[4], row[5], row[6],
            row[11], row[14], row[15], row[17], row[18], row[19],
            row[20], row[21], row[22], row[27],
        ])
        n += 1
sys.stderr.write(f"member={member.filename} rows_ok={n} rows_skip={skip}\n")
