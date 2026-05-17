#!/usr/bin/env python3
import sys, zipfile, csv, io
z = zipfile.ZipFile(sys.argv[1])
m = sorted(z.infolist(), key=lambda x: x.file_size, reverse=True)
member = next((x for x in m if 'EMPRE' in x.filename.upper()), m[0])
out = csv.writer(sys.stdout); n = skip = 0
with z.open(member) as fh:
    r = csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';', quotechar='"')
    for row in r:
        if len(row) < 6:
            skip += 1; continue
        # cnpj_basico, razao_social, natureza_juridica, porte, capital_social
        out.writerow([row[0], row[1], row[2], row[5], row[4]])
        n += 1
sys.stderr.write(f"member={member.filename} rows_ok={n} rows_skip={skip}\n")
