const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error(err.message);
  else console.log('SQLite conectado.');
});

// Colunas de cada tabela (além do id, que é sempre automático).
// Para adicionar um campo novo, basta incluí-lo aqui: bancos já existentes
// recebem a coluna automaticamente na próxima vez que o servidor subir.
const schema = {
  clientes: {
    nome: 'TEXT', email: 'TEXT', telefone: 'TEXT', tipo: 'TEXT', origem: 'TEXT', foto: 'TEXT', rg: 'TEXT',
    cpfCnpj: 'TEXT', dataNascimento: 'TEXT', sexo: 'TEXT', profissao: 'TEXT', renda: 'REAL', estadoCivil: 'TEXT',
    cep: 'TEXT', logradouro: 'TEXT', numero: 'TEXT', bairro: 'TEXT', cidade: 'TEXT', uf: 'TEXT', complemento: 'TEXT',
    finalidade: 'TEXT', areaMinima: 'REAL', tipoImovelBusca: 'TEXT', faixaMin: 'REAL', faixaMax: 'REAL',
    quartosBusca: 'INTEGER', banheirosBusca: 'INTEGER', bairroBusca: 'TEXT', observacoes: 'TEXT',
  },
  proprietarios: {
    nome: 'TEXT', email: 'TEXT', telefone: 'TEXT', tipo: 'TEXT', foto: 'TEXT', rg: 'TEXT', cnpj: 'TEXT', razaoSocial: 'TEXT',
    cpfCnpj: 'TEXT', dataNascimento: 'TEXT', sexo: 'TEXT', estadoCivil: 'TEXT', profissao: 'TEXT',
    cep: 'TEXT', logradouro: 'TEXT', numero: 'TEXT', bairro: 'TEXT', cidade: 'TEXT', uf: 'TEXT', complemento: 'TEXT',
    banco: 'TEXT', agencia: 'TEXT', conta: 'TEXT', tipoConta: 'TEXT', chavePix: 'TEXT', titularConta: 'TEXT',
  },
  imoveis: {
    tipo: 'TEXT', finalidade: 'TEXT', proprietarioId: 'INTEGER', responsavelId: 'INTEGER', responsavel: 'TEXT',
    titulo: 'TEXT', descricao: 'TEXT', cep: 'TEXT', logradouro: 'TEXT', numero: 'TEXT', bairro: 'TEXT', cidade: 'TEXT',
    uf: 'TEXT', complemento: 'TEXT', precoVenda: 'REAL', precoAluguel: 'REAL', condominio: 'REAL', iptu: 'REAL',
    areaTotal: 'REAL', areaTerreno: 'REAL', quartos: 'INTEGER', suites: 'INTEGER', banheiros: 'INTEGER', vagas: 'INTEGER',
    fotos: 'TEXT',
  },
  visitas: {
    clienteId: 'INTEGER', clienteNome: 'TEXT', imovelId: 'INTEGER', imovelTitulo: 'TEXT', corretorId: 'INTEGER',
    corretor: 'TEXT', data: 'TEXT', hora: 'TEXT', status: 'TEXT', descricao: 'TEXT',
  },
  funcionarios: {
    nome: 'TEXT', cpf: 'TEXT', dataNascimento: 'TEXT', telefone: 'TEXT', telefoneFixo: 'TEXT', email: 'TEXT',
    senha: 'TEXT', cargo: 'TEXT', creci: 'TEXT', foto: 'TEXT', rg: 'TEXT', orgaoEmissor: 'TEXT',
    cep: 'TEXT', logradouro: 'TEXT', numero: 'TEXT', bairro: 'TEXT', cidade: 'TEXT', uf: 'TEXT', complemento: 'TEXT',
    observacoes: 'TEXT', status: 'TEXT', dataAdmissao: 'TEXT', salario: 'REAL', perfilId: 'INTEGER',
  },
  negociacoes: {
    clienteId: 'INTEGER', clienteNome: 'TEXT', imovelId: 'INTEGER', imovelTitulo: 'TEXT',
    proprietarioId: 'INTEGER', proprietarioNome: 'TEXT', corretorId: 'INTEGER', corretor: 'TEXT',
    tipo: 'TEXT', data: 'TEXT', valor: 'REAL', status: 'TEXT', formaPagamento: 'TEXT', observacoes: 'TEXT',
    visitaId: 'INTEGER',
  },
  contratos: {
    clienteId: 'INTEGER', clienteNome: 'TEXT', imovelId: 'INTEGER', imovelTitulo: 'TEXT',
    proprietarioId: 'INTEGER', proprietarioNome: 'TEXT', corretorId: 'INTEGER', corretor: 'TEXT',
    tipo: 'TEXT', status: 'TEXT', finalidade: 'TEXT',
    dataInicio: 'TEXT', dataFim: 'TEXT', dataAssinatura: 'TEXT',
    valor: 'REAL', condominio: 'REAL', iptu: 'REAL', diaVencimento: 'INTEGER',
    formaPagamento: 'TEXT', taxaAdministracao: 'REAL', repasseProprietario: 'REAL',
    garantiaTipo: 'TEXT', garantiaValor: 'REAL', garantiaDetalhes: 'TEXT',
    indiceReajuste: 'TEXT', multaAtraso: 'REAL', multaRescisoria: 'TEXT', observacoes: 'TEXT',
    negociacaoId: 'INTEGER',
  },
  perfis: { nome: 'TEXT', descricao: 'TEXT', permissoes: 'TEXT', status: 'TEXT', nativo: 'INTEGER' },
  notificacoes: {
    nome: 'TEXT', gatilho: 'TEXT', canais: 'TEXT', canal: 'TEXT',
    titulo: 'TEXT', mensagem: 'TEXT', destinatario: 'TEXT',
    status: 'TEXT', dataCriacao: 'TEXT', dataEnvio: 'TEXT',
  },
  servicos: { nome: 'TEXT', descricao: 'TEXT', categoria: 'TEXT' },
  // servicos: lista JSON com os ids dos serviços prestados (ex.: "[1,3]")
  prestadores: {
    nome: 'TEXT', especialidade: 'TEXT', telefone: 'TEXT', cpfCnpj: 'TEXT', avaliacao: 'REAL',
    razaoSocial: 'TEXT', email: 'TEXT', pais: 'TEXT', cep: 'TEXT', uf: 'TEXT', cidade: 'TEXT', bairro: 'TEXT', logradouro: 'TEXT',
    numero: 'TEXT', complemento: 'TEXT', servicos: 'TEXT', banco: 'TEXT', agencia: 'TEXT', conta: 'TEXT',
    tipoChavePix: 'TEXT', chavePix: 'TEXT',
  },
  reparos: {
    imovelId: 'INTEGER', prestadorId: 'INTEGER', descricao: 'TEXT', dataSolicitacao: 'TEXT', status: 'TEXT', valor: 'REAL',
    servicoId: 'INTEGER', responsavelId: 'INTEGER', responsavel: 'TEXT',
  },
  canais: { nome: 'TEXT', tipoCanal: 'TEXT', observacoes: 'TEXT' },
  anuncios: {
    imovelId: 'INTEGER', canal: 'TEXT', dataPublicacao: 'TEXT', status: 'TEXT', cliques: 'INTEGER', contatos: 'INTEGER',
    canalId: 'INTEGER', descricao: 'TEXT', valor: 'REAL', fotos: 'TEXT',
  },
  despesas: {
    descricao: 'TEXT', valor: 'REAL', dataVencimento: 'TEXT', dataPagamento: 'TEXT',
    status: 'TEXT', categoria: 'TEXT', imovelId: 'INTEGER', imovelTitulo: 'TEXT',
    formaPagamento: 'TEXT', observacoes: 'TEXT', comprovante: 'TEXT', historicoStatus: 'TEXT',
    reparoId: 'INTEGER',
  },
  multas: {
    contratoId: 'INTEGER', clienteId: 'INTEGER', clienteNome: 'TEXT',
    motivo: 'TEXT', tipo: 'TEXT', modoValor: 'TEXT', valor: 'REAL', percentual: 'REAL', valorCalculado: 'REAL',
    dataAplicacao: 'TEXT', dataVencimento: 'TEXT', status: 'TEXT', historicoStatus: 'TEXT',
  },
  financeiro: {
    tipo: 'TEXT', categoria: 'TEXT', descricao: 'TEXT', valor: 'REAL',
    dataVencimento: 'TEXT', dataPagamento: 'TEXT', status: 'TEXT',
    formaPagamento: 'TEXT', clienteId: 'INTEGER', clienteNome: 'TEXT',
    proprietarioId: 'INTEGER', proprietarioNome: 'TEXT',
    imovelId: 'INTEGER', imovelTitulo: 'TEXT', contratoId: 'INTEGER',
    comprovante: 'TEXT', observacoes: 'TEXT', reciboNumero: 'TEXT',
    operador: 'TEXT', data: 'TEXT',
  },
  auditoria: {
    usuario: 'TEXT', computador: 'TEXT', acao: 'TEXT', entidade: 'TEXT', entidadeId: 'INTEGER',
    detalhes: 'TEXT', data: 'TEXT', hora: 'TEXT', ip: 'TEXT',
  },
  usuario_ips: {
    usuario: 'TEXT', computador: 'TEXT', ip: 'TEXT', criadoEm: 'TEXT',
  },
  // Configurações gerais da imobiliária (um único registro)
  configuracoes: {
    nomeFantasia: 'TEXT', razaoSocial: 'TEXT', cnpj: 'TEXT', creci: 'TEXT', telefone: 'TEXT', email: 'TEXT', site: 'TEXT', logo: 'TEXT',
    cep: 'TEXT', logradouro: 'TEXT', numero: 'TEXT', bairro: 'TEXT', cidade: 'TEXT', uf: 'TEXT', complemento: 'TEXT',
    taxaAdministracao: 'REAL', comissaoVenda: 'REAL', multaAtraso: 'REAL', jurosDia: 'REAL',
    diaVencimento: 'INTEGER', indiceReajuste: 'TEXT', prazoRepasse: 'INTEGER',
  },
};

// "pronto" resolve quando todas as tabelas já foram criadas (usado antes de popular um banco novo)
let tabelasCriadas;
const pronto = new Promise(resolve => { tabelasCriadas = resolve; });

db.serialize(() => {
  Object.entries(schema).forEach(([table, columns]) => {
    const cols = Object.entries(columns).map(([name, type]) => `${name} ${type}`).join(', ');
    db.run(`CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols})`);

    // Adiciona colunas que faltarem em bancos criados por versões anteriores
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return console.error(err.message);
      const existing = rows.map(r => r.name);
      Object.entries(columns)
        .filter(([name]) => !existing.includes(name))
        .forEach(([name, type]) => db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`));
    });
  });
  db.get('SELECT 1', () => tabelasCriadas());
});

db.schema = schema;
db.pronto = pronto;
module.exports = db;
