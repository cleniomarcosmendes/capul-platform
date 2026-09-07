"""
VARREDURA DE CONTRATO — o que o backend manda e a tela descarta.

Rode de dentro de `gestao-pessoas/frontend`:   python3 scripts/varredura-contrato.py

⚠️ ELA SÓ ACHA METADE DA CLASSE. Pega o campo que o contrato DECLARA e nenhuma
tela usa. NÃO pega o campo que o backend devolve e o contrato nem declara — que
foi o caso do `foraDeTodasAsAplicacoes`, o primeiro achado desta família. Para
esse lado só há duas saídas de verdade: gerar o cliente a partir do backend, ou
um teste de contrato comparando a resposta real com o tipo.

Falsos positivos esperados: tipos de ENTRADA (NovoCiclo, NovaAplicacao,
AlvoDoPublico) — a tela ENVIA esses campos, não os renderiza. Ver §3.1.9 do
docs/ESTADO-DO-PROJETO.md.
"""
import re, os, io, subprocess

RAIZ='src'
api=io.open('src/services/api.ts',encoding='utf-8').read()

# 1) todos os campos declarados em cada interface do contrato
interfaces={}
for m in re.finditer(r'export interface (\w+)\s*(?:extends [^{]+)?\{(.*?)\n\}', api, re.S):
    nome, corpo = m.group(1), m.group(2)
    campos=[]
    for linha in corpo.split('\n'):
        c=re.match(r'\s*(\w+)\??:', linha)
        if c and not linha.strip().startswith('//'):
            campos.append(c.group(1))
    if campos: interfaces[nome]=campos

# 2) todo o fonte das telas (fora do contrato)
telas=[]
for base,_,arqs in os.walk(RAIZ):
    for a in arqs:
        if a.endswith(('.tsx','.ts')) and 'services/api.ts' not in os.path.join(base,a):
            telas.append(os.path.join(base,a))
fonte='\n'.join(io.open(f,encoding='utf-8').read() for f in telas)

GENERICOS={'id','nome','total','status','tipo','codigo','descricao','ordem','cor','filial','matricula','cargo','area'}
print(f'{len(interfaces)} interfaces · {len(telas)} arquivos de tela\n')
print('CAMPO DO CONTRATO QUE NENHUMA TELA USA')
print('=' * 78)
achados=[]
for nome, campos in sorted(interfaces.items()):
    orfaos=[]
    for c in campos:
        # uso por acesso (.campo), destructuring ({ campo ) ou chave literal
        if re.search(r'[.\[\'"{,\s]'+re.escape(c)+r'\b', fonte.replace('interface','')):
            # refina: precisa aparecer como .campo ou campo: ou {campo}
            if re.search(r'\.'+re.escape(c)+r'\b', fonte) or re.search(r'\b'+re.escape(c)+r'\s*[,}]', fonte):
                continue
        orfaos.append(c)
    if orfaos:
        achados.append((nome,orfaos))
        print(f'{nome:32} {", ".join(orfaos)}')
print()
print(f'{sum(len(o) for _,o in achados)} campos suspeitos em {len(achados)} interfaces')
