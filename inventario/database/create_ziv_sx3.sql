-- =====================================================
-- SCRIPT: Criar campos da tabela ZIV no SX3010
-- Banco: CAPULHLG (Homologação)
-- Data: 24/11/2025
-- =====================================================

-- Campos NOT NULL do SX3010 que precisam ter valores:
-- X3_VALID (160), X3_RELACAO (160), X3_VLDUSER (160)
-- X3_PICTVAR (50), X3_WHEN (100), X3_INIBRW (100)

-- Campo 01: ZIV_FILIAL
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '01', 'ZIV_FILIAL', 'C', 2, 0,
    'Filial', 'Filial', 'Branch', 'Filial do Sistema', 'Filial del Sistema', 'System Branch',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184099, 0
);

-- Campo 02: ZIV_INVNOM
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '02', 'ZIV_INVNOM', 'C', 50, 0,
    'Nm Inventar', 'Nm Inventar', 'Inv Name', 'Nome do Inventario', 'Nombre Inventario', 'Inventory Name',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184100, 0
);

-- Campo 03: ZIV_INVDAT
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '03', 'ZIV_INVDAT', 'D', 8, 0,
    'Dt Inventar', 'Dt Inventar', 'Inv Date', 'Data do Inventario', 'Fecha Inventario', 'Inventory Date',
    ' ', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184101, 0
);

-- Campo 04: ZIV_ARMAZE
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '04', 'ZIV_ARMAZE', 'C', 2, 0,
    'Armazem', 'Almacen', 'Warehouse', 'Armazem Principal', 'Almacen Principal', 'Main Warehouse',
    '@!', ' ', ' ', ' ', 'NNR', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184102, 0
);

-- Campo 05: ZIV_ARMCOM
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '05', 'ZIV_ARMCOM', 'C', 2, 0,
    'Arm Compara', 'Alm Compara', 'Wh Compare', 'Armazem Comparativo', 'Almacen Comparativo', 'Comparative Warehouse',
    '@!', ' ', ' ', ' ', 'NNR', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184103, 0
);

-- Campo 06: ZIV_TIPO
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '06', 'ZIV_TIPO  ', 'C', 1, 0,
    'Tipo', 'Tipo', 'Type', 'Tipo Inventario', 'Tipo Inventario', 'Inventory Type',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', 'R',
    'x       ', ' ', 'S=Simples;C=Comparativo', 'S=Simple;C=Comparativo', 'S=Simple;C=Comparative', ' ',
    ' ', ' ', ' ', 184104, 0
);

-- Campo 07: ZIV_CODIGO
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '07', 'ZIV_CODIGO', 'C', 15, 0,
    'Codigo Prod', 'Codigo Prod', 'Product Cd', 'Codigo do Produto', 'Codigo del Producto', 'Product Code',
    '@!', ' ', ' ', ' ', 'SB1', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184105, 0
);

-- Campo 08: ZIV_DESCRI
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '08', 'ZIV_DESCRI', 'C', 50, 0,
    'Descricao', 'Descripcion', 'Description', 'Descricao do Produto', 'Descripcion Producto', 'Product Description',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184106, 0
);

-- Campo 09: ZIV_LOTECT
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '09', 'ZIV_LOTECT', 'C', 40, 0,
    'Lote', 'Lote', 'Batch', 'Numero do Lote', 'Numero del Lote', 'Batch Number',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184107, 0
);

-- Campo 10: ZIV_LOTEFO
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '10', 'ZIV_LOTEFO', 'C', 40, 0,
    'Lote Fornec', 'Lote Proven', 'Supplier Bt', 'Lote do Fornecedor', 'Lote del Proveedor', 'Supplier Batch',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184108, 0
);

-- Campo 11: ZIV_SALDO
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '11', 'ZIV_SALDO ', 'N', 14, 4,
    'Saldo Sist', 'Saldo Sist', 'Sys Balance', 'Saldo Sistema Esperado', 'Saldo Sistema Esperado', 'Expected System Balance',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184109, 0
);

-- Campo 12: ZIV_ENTPOS
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '12', 'ZIV_ENTPOS', 'N', 14, 4,
    'Entr Poster', 'Entr Poster', 'Later Deliv', 'Entrega Posterior', 'Entrega Posterior', 'Later Delivery',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184110, 0
);

-- Campo 13: ZIV_CONT1
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '13', 'ZIV_CONT1 ', 'N', 14, 4,
    '1a Contagem', '1a Contagem', '1st Count', 'Primeira Contagem', 'Primera Conteo', 'First Count',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184111, 0
);

-- Campo 14: ZIV_CONT2
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '14', 'ZIV_CONT2 ', 'N', 14, 4,
    '2a Contagem', '2a Contagem', '2nd Count', 'Segunda Contagem', 'Segunda Conteo', 'Second Count',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184112, 0
);

-- Campo 15: ZIV_CONT3
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '15', 'ZIV_CONT3 ', 'N', 14, 4,
    '3a Contagem', '3a Contagem', '3rd Count', 'Terceira Contagem', 'Tercera Conteo', 'Third Count',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184113, 0
);

-- Campo 16: ZIV_USRC1
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '16', 'ZIV_USRC1 ', 'C', 30, 0,
    'Usr 1a Cont', 'Usr 1a Cont', 'Usr 1st Cnt', 'Usuario 1a Contagem', 'Usuario 1a Conteo', 'User 1st Count',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184114, 0
);

-- Campo 17: ZIV_USRC2
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '17', 'ZIV_USRC2 ', 'C', 30, 0,
    'Usr 2a Cont', 'Usr 2a Cont', 'Usr 2nd Cnt', 'Usuario 2a Contagem', 'Usuario 2a Conteo', 'User 2nd Count',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184115, 0
);

-- Campo 18: ZIV_USRC3
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '18', 'ZIV_USRC3 ', 'C', 30, 0,
    'Usr 3a Cont', 'Usr 3a Cont', 'Usr 3rd Cnt', 'Usuario 3a Contagem', 'Usuario 3a Conteo', 'User 3rd Count',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184116, 0
);

-- Campo 19: ZIV_DATC1
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '19', 'ZIV_DATC1 ', 'D', 8, 0,
    'Dt 1a Cont', 'Dt 1a Cont', 'Dt 1st Cnt', 'Data 1a Contagem', 'Fecha 1a Conteo', 'Date 1st Count',
    ' ', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184117, 0
);

-- Campo 20: ZIV_DATC2
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '20', 'ZIV_DATC2 ', 'D', 8, 0,
    'Dt 2a Cont', 'Dt 2a Cont', 'Dt 2nd Cnt', 'Data 2a Contagem', 'Fecha 2a Conteo', 'Date 2nd Count',
    ' ', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184118, 0
);

-- Campo 21: ZIV_DATC3
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '21', 'ZIV_DATC3 ', 'D', 8, 0,
    'Dt 3a Cont', 'Dt 3a Cont', 'Dt 3rd Cnt', 'Data 3a Contagem', 'Fecha 3a Conteo', 'Date 3rd Count',
    ' ', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184119, 0
);

-- Campo 22: ZIV_HORAC1
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '22', 'ZIV_HORAC1', 'C', 8, 0,
    'Hr 1a Cont', 'Hr 1a Cont', 'Hr 1st Cnt', 'Hora 1a Contagem', 'Hora 1a Conteo', 'Hour 1st Count',
    '@R 99:99:99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184120, 0
);

-- Campo 23: ZIV_HORAC2
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '23', 'ZIV_HORAC2', 'C', 8, 0,
    'Hr 2a Cont', 'Hr 2a Cont', 'Hr 2nd Cnt', 'Hora 2a Contagem', 'Hora 2a Conteo', 'Hour 2nd Count',
    '@R 99:99:99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184121, 0
);

-- Campo 24: ZIV_HORAC3
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '24', 'ZIV_HORAC3', 'C', 8, 0,
    'Hr 3a Cont', 'Hr 3a Cont', 'Hr 3rd Cnt', 'Hora 3a Contagem', 'Hora 3a Conteo', 'Hour 3rd Count',
    '@R 99:99:99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184122, 0
);

-- Campo 25: ZIV_QTFINA
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '25', 'ZIV_QTFINA', 'N', 14, 4,
    'Qtd Final', 'Ctd Final', 'Final Qty', 'Quantidade Final', 'Cantidad Final', 'Final Quantity',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184123, 0
);

-- Campo 26: ZIV_DIFERE
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '26', 'ZIV_DIFERE', 'N', 14, 4,
    'Diferenca', 'Diferencia', 'Difference', 'Diferenca Contado-Saldo', 'Diferencia Contado-Saldo', 'Counted-Balance Difference',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184124, 0
);

-- Campo 27: ZIV_VLRDIF
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '27', 'ZIV_VLRDIF', 'N', 14, 2,
    'Vlr Diferen', 'Vlr Diferen', 'Diff Value', 'Valor da Diferenca R$', 'Valor Diferencia R$', 'Difference Value R$',
    '@E 999,999,999.99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184125, 0
);

-- Campo 28: ZIV_CUSTOM
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '28', 'ZIV_CUSTOM', 'N', 14, 4,
    'Custo Medio', 'Costo Medio', 'Avg Cost', 'Custo Medio Unitario', 'Costo Medio Unitario', 'Average Unit Cost',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184126, 0
);

-- Campo 29: ZIV_STATUS
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '29', 'ZIV_STATUS', 'C', 1, 0,
    'Status', 'Status', 'Status', 'Status do Item', 'Status del Item', 'Item Status',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'S', ' ', ' ',
    '        ', ' ', 'C=Conferido;P=Pendente;D=Divergente;Z=Zero Confirm', 'C=Conferido;P=Pendiente;D=Divergente;Z=Zero Confirm', 'C=Checked;P=Pending;D=Divergent;Z=Zero Confirmed', ' ',
    ' ', ' ', ' ', 184127, 0
);

-- Campo 30: ZIV_QTRANS
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '30', 'ZIV_QTRANS', 'N', 14, 4,
    'Qt Transf', 'Ct Transf', 'Transfer Qty', 'Quantidade Transferida', 'Cantidad Transferida', 'Transfer Quantity',
    '@E 9,999,999,999.9999', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184128, 0
);

-- Campo 31: ZIV_ARMTRA
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '31', 'ZIV_ARMTRA', 'C', 2, 0,
    'Arm Transf', 'Alm Transf', 'Wh Transfer', 'Armazem Transferencia', 'Almacen Transferencia', 'Transfer Warehouse',
    '@!', ' ', ' ', ' ', 'NNR', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184129, 0
);

-- Campo 32: ZIV_TIPTR
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '32', 'ZIV_TIPTR ', 'C', 1, 0,
    'Tp Transf', 'Tp Transf', 'Transfer Tp', 'Tipo Transferencia', 'Tipo Transferencia', 'Transfer Type',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', 'E=Entrada;S=Saida', 'E=Entrada;S=Salida', 'E=In;S=Out', ' ',
    ' ', ' ', ' ', 184130, 0
);

-- Campo 33: ZIV_ECONOM
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '33', 'ZIV_ECONOM', 'N', 14, 2,
    'Economia', 'Economia', 'Savings', 'Economia Gerada R$', 'Economia Generada R$', 'Generated Savings R$',
    '@E 999,999,999.99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184131, 0
);

-- Campo 34: ZIV_OBSERV
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '34', 'ZIV_OBSERV', 'C', 100, 0,
    'Observacao', 'Observacion', 'Observation', 'Observacoes', 'Observaciones', 'Observations',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184132, 0
);

-- Campo 35: ZIV_USRINC
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '35', 'ZIV_USRINC', 'C', 30, 0,
    'Usr Inclus', 'Usr Inclus', 'Incl User', 'Usuario Inclusao', 'Usuario Inclusion', 'Inclusion User',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184133, 0
);

-- Campo 36: ZIV_DATINC
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '36', 'ZIV_DATINC', 'D', 8, 0,
    'Dt Inclusao', 'Dt Inclusao', 'Incl Date', 'Data Inclusao', 'Fecha Inclusion', 'Inclusion Date',
    ' ', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184134, 0
);

-- Campo 37: ZIV_HORINC
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '37', 'ZIV_HORINC', 'C', 8, 0,
    'Hr Inclusao', 'Hr Inclusao', 'Incl Hour', 'Hora Inclusao', 'Hora Inclusion', 'Inclusion Hour',
    '@R 99:99:99', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', ' ',
    '        ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184135, 0
);

-- Campo 38: ZIV_ORIGIN
INSERT INTO TOTVS_PRD.SX3010 (
    X3_ARQUIVO, X3_ORDEM, X3_CAMPO, X3_TIPO, X3_TAMANHO, X3_DECIMAL,
    X3_TITULO, X3_TITSPA, X3_TITENG, X3_DESCRIC, X3_DESCSPA, X3_DESCENG,
    X3_PICTURE, X3_VALID, X3_USADO, X3_RELACAO, X3_F3, X3_NIVEL, X3_RESERV,
    X3_CHECK, X3_TRIGGER, X3_PROPRI, X3_BROWSE, X3_VISUAL, X3_CONTEXT,
    X3_OBRIGAT, X3_VLDUSER, X3_CBOX, X3_CBOXSPA, X3_CBOXENG, X3_PICTVAR,
    X3_WHEN, X3_INIBRW, D_E_L_E_T_, R_E_C_N_O_, R_E_C_D_E_L_
) VALUES (
    'ZIV', '38', 'ZIV_ORIGIN', 'C', 20, 0,
    'Origem', 'Origen', 'Origin', 'Sistema Origem', 'Sistema Origen', 'Origin System',
    '@!', ' ', ' ', ' ', ' ', 1, ' ',
    ' ', ' ', ' ', 'N', ' ', 'R',
    'x       ', ' ', ' ', ' ', ' ', ' ',
    ' ', ' ', ' ', 184136, 0
);

COMMIT;
