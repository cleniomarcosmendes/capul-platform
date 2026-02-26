"""
Modelos SQLAlchemy read-only para o schema core.
Permitem que o FastAPI consulte diretamente core.filiais, core.usuarios, etc.
sem depender de views ou triggers de compatibilidade.

IMPORTANTE: Estes modelos sao READ-ONLY. A gestao de usuarios e filiais
e feita pelo Auth Gateway (NestJS). O inventario apenas consulta.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.models import Base


class CoreFilial(Base):
    """Read-only: core.filiais (gerenciada pelo Auth Gateway)"""
    __tablename__ = 'filiais'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    codigo = Column(String(10))
    razao_social = Column(String(200))
    nome_fantasia = Column(String(200))
    cnpj = Column(String(20))
    descricao = Column(String)
    endereco = Column(String)
    cidade = Column(String)
    estado = Column(String)
    cep = Column(String)
    telefone = Column(String)
    email = Column(String)
    status = Column(String, default='ATIVO')
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))

    empresa_id = Column(String, ForeignKey('core.empresas.id'))

    # Relacionamentos read-only
    usuario_filiais = relationship('CoreUsuarioFilial', back_populates='filial', viewonly=True)


class CoreUsuario(Base):
    """Read-only: core.usuarios (gerenciada pelo Auth Gateway)"""
    __tablename__ = 'usuarios'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    username = Column(String(50))
    email = Column(String(200))
    nome = Column(String(200))
    senha = Column(String)
    telefone = Column(String)
    cargo = Column(String)
    avatar_url = Column(String)
    status = Column(String, default='ATIVO')
    primeiro_acesso = Column(Boolean, default=True)
    ultimo_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))

    filial_principal_id = Column(String, ForeignKey('core.filiais.id'))
    departamento_id = Column(String, ForeignKey('core.departamentos.id'))

    # Relacionamentos read-only
    filiais = relationship('CoreUsuarioFilial', back_populates='usuario', viewonly=True)
    permissoes = relationship('CorePermissaoModulo', back_populates='usuario', viewonly=True)

    @property
    def ativo(self):
        return self.status == 'ATIVO'


class CoreUsuarioFilial(Base):
    """Read-only: core.usuario_filiais"""
    __tablename__ = 'usuario_filiais'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    usuario_id = Column(String, ForeignKey('core.usuarios.id'))
    filial_id = Column(String, ForeignKey('core.filiais.id'))
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True))
    created_by = Column(String)
    updated_at = Column(DateTime(timezone=True))

    # Relacionamentos
    usuario = relationship('CoreUsuario', back_populates='filiais')
    filial = relationship('CoreFilial', back_populates='usuario_filiais')


class CoreModuloSistema(Base):
    """Read-only: core.modulos_sistema"""
    __tablename__ = 'modulos_sistema'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    codigo = Column(String, unique=True)
    nome = Column(String)
    descricao = Column(String)
    status = Column(String, default='ATIVO')

    roles_disponiveis = relationship('CoreRoleModulo', back_populates='modulo', viewonly=True)


class CoreRoleModulo(Base):
    """Read-only: core.roles_modulo"""
    __tablename__ = 'roles_modulo'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    codigo = Column(String)
    nome = Column(String)
    descricao = Column(String)

    modulo_id = Column(String, ForeignKey('core.modulos_sistema.id'))
    modulo = relationship('CoreModuloSistema', back_populates='roles_disponiveis')

    permissoes = relationship('CorePermissaoModulo', back_populates='role_modulo', viewonly=True)


class CorePermissaoModulo(Base):
    """Read-only: core.permissoes_modulo"""
    __tablename__ = 'permissoes_modulo'
    __table_args__ = {'schema': 'core'}

    id = Column(String, primary_key=True)
    status = Column(String, default='ATIVO')
    created_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True))

    usuario_id = Column(String, ForeignKey('core.usuarios.id'))
    modulo_id = Column(String, ForeignKey('core.modulos_sistema.id'))
    role_modulo_id = Column(String, ForeignKey('core.roles_modulo.id'))

    usuario = relationship('CoreUsuario', back_populates='permissoes')
    role_modulo = relationship('CoreRoleModulo', back_populates='permissoes')
