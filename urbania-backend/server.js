const express = require('express');
const cors = require('cors');
const db = require('./database');
const popularDadosDeTeste = require('./dados-teste');
const { idVisitante, gerarToken, carregarSessao, autenticar, autorizar, filtrarFuncionario, garantirAcessosPadrao } = require('./permissoes');

const app = express();
app.use(cors());
// Limite maior porque fotos são enviadas junto com o cadastro
app.use(express.json({ limit: '25mb' }));
// Toda rota /api (exceto o login) exige um token válido
app.use(autenticar);

const tables = Object.keys(db.schema);

// Só aceita campos que existem na tabela (evita erro de SQL e injeção pelo nome da coluna)
const pickColumns = (table, body) => {
  const columns = db.schema[table];
  const data = {};
  Object.keys(body || {}).forEach(k => {
    if (k in columns) data[k] = body[k] === '' ? null : body[k];
  });
  return data;
};

// Registros que impedem a exclusão (requisitos 1.5.4 / 1.5.3 / 1.7.1)
const deleteGuards = {
  clientes: [['visitas', 'clienteId', 'visita(s)'], ['negociacoes', 'clienteId', 'negociação(ões)'], ['contratos', 'clienteId', 'contrato(s)']],
  proprietarios: [['imoveis', 'proprietarioId', 'imóvel(is)'], ['negociacoes', 'proprietarioId', 'negociação(ões)'], ['contratos', 'proprietarioId', 'contrato(s)']],
  imoveis: [['visitas', 'imovelId', 'visita(s)'], ['negociacoes', 'imovelId', 'negociação(ões)'], ['contratos', 'imovelId', 'contrato(s)']],
  funcionarios: [['visitas', 'corretorId', 'visita(s)'], ['negociacoes', 'corretorId', 'negociação(ões)'], ['imoveis', 'responsavelId', 'imóvel(is)'], ['contratos', 'corretorId', 'contrato(s)']],
  contratos: [['multas', 'contratoId', 'multa(s)']],
  despesas: [['despesas', 'id', 'despesa(s) já paga(s) (permitido apenas cancelamento)', "id = ? AND status = 'Pago'"]],
  multas: [['multas', 'id', 'multa(s) já paga(s) (permitido apenas cancelamento)', "id = ? AND status = 'Pago'"]],
  perfis: [['funcionarios', 'perfilId', 'usuário(s) vinculado(s)'], ['perfis', 'id', 'perfil nativo do sistema (não pode ser excluído)', "id = ? AND nativo = 1"]],
  financeiro: [['financeiro', 'id', 'operação(ões) já quitada(s)/paga(s)', "id = ? AND status = 'Pago'"]],
  // 4º item opcional: condição própria (prestadores.servicos é uma lista JSON de ids)
  servicos: [['reparos', 'servicoId', 'reparo(s)'], ['prestadores', 'servicos', 'prestador(es)', 'EXISTS (SELECT 1 FROM json_each(servicos) WHERE value = CAST(? AS INTEGER))']],
  prestadores: [['reparos', 'prestadorId', 'reparo(s)']],
  canais: [['anuncios', 'canalId', 'anúncio(s)']],
};

const get = (sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));

const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function(err) { return err ? reject(err) : resolve(this); }));

const os = require('os');

// Nome usado na auditoria, sem duplicar termos como (Admin) e (Administrador)
const formatUsuario = (user) => {
  if (!user) return 'Sistema';
  let nome = (user.nome || '').replace(/\s*\((?:Admin|Administrador)\)\s*/gi, '').trim();
  const cargo = (user.cargo || '').trim();
  if (!cargo || nome.toLowerCase() === cargo.toLowerCase()) {
    return nome || cargo || 'Sistema';
  }
  return `${nome} (${cargo})`;
};

const quem = req => req.sessao ? formatUsuario(req.sessao.user) : 'Sistema';

// Gerenciamento de IP padrão fixo/atribuído por usuário iniciando em 192.168.1.1
const getWorkstationUser = (req) => {
  const customUser = req?.headers?.['x-client-user'];
  if (customUser && customUser.trim() && customUser !== 'root') return customUser.trim();
  const customDev = req?.headers?.['x-client-device'];
  if (customDev && customDev.trim() && !customDev.startsWith('srv-') && customDev !== 'root') {
    return customDev.trim().replace(/^Pc[-_]/i, '');
  }
  const osUser = process.env.USERNAME || process.env.USER;
  if (osUser && osUser.trim() && osUser !== 'root' && !osUser.startsWith('srv-')) {
    return osUser.trim();
  }
  return 'GM';
};

const getComputerName = (req) => {
  const custom = req?.headers?.['x-client-device'] || req?.headers?.['x-client-user'];
  if (custom && custom.trim()) {
    let val = custom.trim();
    if (!val.startsWith('srv-') && val !== 'root' && val !== 'Pc-root') {
      return (val.startsWith('Pc-') || val.startsWith('Pc_')) ? val : `Pc-${val}`;
    }
  }
  const osUser = process.env.USERNAME || process.env.USER;
  if (osUser && osUser.trim() && osUser !== 'root' && !osUser.startsWith('srv-')) {
    return `Pc-${osUser.trim()}`;
  }
  const host = process.env.COMPUTERNAME || os.hostname();
  if (host && !host.startsWith('srv-') && host !== 'localhost') {
    return host.startsWith('Pc-') ? host : `Pc-${host}`;
  }
  return 'Pc-GM';
};

const getUserIp = async (req, usuarioNome) => {
  const comp = getComputerName(req);
  const nome = (usuarioNome || quem(req) || 'Sistema').trim();

  try {
    // 1. Procura se este usuário já possui IP atribuído na tabela usuario_ips
    let row = await get('SELECT ip FROM usuario_ips WHERE LOWER(usuario) = LOWER(?)', [nome]);
    if (row?.ip) return row.ip;

    // 2. Se for Diretoria / Admin ou o computador for Pc-GM, o primeiro IP padrão é 192.168.1.1
    if (nome.toLowerCase().includes('diretoria') || nome.toLowerCase().includes('admin') || comp.toLowerCase() === 'pc-gm') {
      const primeiroIp = '192.168.1.1';
      await run('INSERT INTO usuario_ips (usuario, computador, ip, criadoEm) VALUES (?, ?, ?, ?)', [
        nome, comp, primeiroIp, new Date().toISOString()
      ]);
      return primeiroIp;
    }

    // 3. Procura pelo computador caso já tenha recebido IP
    row = await get('SELECT ip FROM usuario_ips WHERE LOWER(computador) = LOWER(?)', [comp]);
    if (row?.ip) {
      await run('INSERT INTO usuario_ips (usuario, computador, ip, criadoEm) VALUES (?, ?, ?, ?)', [
        nome, comp, row.ip, new Date().toISOString()
      ]);
      return row.ip;
    }

    // 4. Usuário diferente: busca o maior número de IP alocado no padrão 192.168.1.X e incrementa +1
    const allRows = await new Promise((res, rej) =>
      db.all('SELECT ip FROM usuario_ips', [], (err, rows) => err ? rej(err) : res(rows || []))
    );
    let maxNum = 0;
    allRows.forEach(r => {
      const match = String(r.ip || '').match(/^192\.168\.1\.(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });

    const proximoNumero = maxNum + 1;
    const novoIp = `192.168.1.${proximoNumero}`;

    await run('INSERT INTO usuario_ips (usuario, computador, ip, criadoEm) VALUES (?, ?, ?, ?)', [
      nome, comp, novoIp, new Date().toISOString()
    ]);

    return novoIp;
  } catch (err) {
    return '192.168.1.1';
  }
};

const logAudit = async (usuario, acao, entidade, entidadeId, detalhes, req) => {
  if (entidade === 'auditoria') return;
  // Logs gerados apenas em edição, inclusão e exclusão
  const acoesPermitidas = ['Criação', 'Alteração', 'Exclusão', 'Inclusão', 'Edição'];
  if (!acoesPermitidas.includes(acao)) return;

  const now = new Date();
  // Horário oficial de Ji-Paraná / Rondônia (RO) - UTC-4 no formato 00:00 (apenas horas e minutos)
  const data = now.toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
  const hora = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Porto_Velho', hour: '2-digit', minute: '2-digit', hour12: false });
  const comp = getComputerName(req);
  const userIp = await getUserIp(req, usuario);

  db.run(
    `INSERT INTO auditoria (usuario, computador, acao, entidade, entidadeId, detalhes, data, hora, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuario || 'Sistema', comp, acao, entidade, entidadeId || null, detalhes || '', data, hora, userIp]
  );
};

// Rota pública para o frontend descobrir o nome da máquina/usuário do SO
app.get('/api/device-info', (req, res) => {
  let osUser = process.env.USERNAME || process.env.USER;
  if (!osUser || osUser === 'root' || osUser.startsWith('srv-')) {
    osUser = 'GM';
  }
  res.json({
    osUser,
    computerName: `Pc-${osUser}`,
  });
});

// Impede relacionar funcionário/corretor inativo a qualquer entidade (imóvel, visita, proposta, contrato, reparo)
const validarFuncionarioAtivo = async (table, data) => {
  const field = (table === 'imoveis' || table === 'reparos')
    ? 'responsavelId'
    : (table === 'visitas' || table === 'negociacoes' || table === 'contratos' ? 'corretorId' : null);

  if (field && data[field] !== undefined && data[field] !== null && data[field] !== '') {
    const funcId = Number(data[field]);
    if (!isNaN(funcId) && funcId > 0) {
      const func = await get('SELECT id, nome, status, cargo FROM funcionarios WHERE id = ?', [funcId]);
      if (!func) {
        return 'O funcionário/corretor selecionado não foi encontrado no sistema.';
      }
      if (func.status && String(func.status).toLowerCase() === 'inativo') {
        const papel = table === 'reparos' ? 'funcionário responsável' : 'corretor';
        return `Não é possível relacionar o ${papel} "${func.nome}" pois seu cadastro está inativo no sistema.`;
      }
    }
  }
  return null;
};

// Integrações automáticas entre módulos, executadas após gravar um registro
const aposSalvar = async (table, id, req) => {
  // Reparo com orçamento gera/atualiza a despesa correspondente no caixa (enquanto ela não estiver paga)
  if (table === 'reparos') {
    const reparo = await get('SELECT * FROM reparos WHERE id = ?', [id]);
    if (!reparo || !(Number(reparo.valor) > 0)) return;
    const servico = await get('SELECT nome FROM servicos WHERE id = ?', [reparo.servicoId]);
    const prestador = await get('SELECT nome FROM prestadores WHERE id = ?', [reparo.prestadorId]);
    const imovel = await get('SELECT titulo FROM imoveis WHERE id = ?', [reparo.imovelId]);
    const descricao = `Reparo #${id} - ${servico?.nome || 'Manutenção'}${prestador ? ` (${prestador.nome})` : ''}`;
    const despesa = await get('SELECT id, status FROM despesas WHERE reparoId = ?', [id]);

    if (!despesa) {
      const r = await run(
        `INSERT INTO despesas (descricao, valor, dataVencimento, status, categoria, imovelId, imovelTitulo, observacoes, reparoId)
         VALUES (?, ?, ?, 'Pendente', 'Manutenção de imóveis sob gestão', ?, ?, ?, ?)`,
        [descricao, reparo.valor, reparo.dataSolicitacao || new Date().toISOString().slice(0, 10),
          reparo.imovelId, imovel?.titulo || null, `Gerada automaticamente a partir do Reparo #${id}.`, id]
      );
      logAudit(quem(req), 'Criação', 'despesas', r.lastID, JSON.stringify({
        tipo: 'criacao', resumo: `Despesa #${r.lastID} gerada automaticamente pelo Reparo #${id}`,
        campos: [{ campo: 'descricao', valor: descricao }, { campo: 'valor', valor: reparo.valor }],
      }), req);
    } else if (despesa.status !== 'Pago') {
      await run('UPDATE despesas SET descricao = ?, valor = ?, imovelId = ?, imovelTitulo = ? WHERE id = ?',
        [descricao, reparo.valor, reparo.imovelId, imovel?.titulo || null, despesa.id]);
    }
  }

  // Contrato originado de uma negociação: a negociação passa a "Convertida em Contrato"
  if (table === 'contratos') {
    const contrato = await get('SELECT negociacaoId FROM contratos WHERE id = ?', [id]);
    if (!contrato?.negociacaoId) return;
    const r = await run("UPDATE negociacoes SET status = 'Convertida em Contrato' WHERE id = ? AND status != 'Convertida em Contrato'", [contrato.negociacaoId]);
    if (r.changes) {
      logAudit(quem(req), 'Alteração', 'negociacoes', contrato.negociacaoId, JSON.stringify({
        tipo: 'alteracao', resumo: `Negociação convertida no Contrato #${id}`,
        mudancas: [{ campo: 'status', de: null, para: 'Convertida em Contrato' }],
      }), req);
    }
  }
};

tables.forEach(table => {
  // Cada método exige a ação correspondente no perfil (GET=Visualizar, POST=Criar, PUT=Editar, DELETE=Excluir)
  app.use(`/api/${table}`, autorizar(table));

  // Funcionários nunca expõem a senha; dados pessoais só para quem administra a equipe
  const saida = (req, row) => (table === 'funcionarios' ? filtrarFuncionario(row, req.sessao.permissoes) : row);

  // GET ALL (aceita filtros simples: /api/visitas?clienteId=3)
  app.get(`/api/${table}`, (req, res) => {
    const filters = pickColumns(table, req.query);
    const keys = Object.keys(filters);
    const whereParts = keys.map(k => {
      if (k === 'status') return 'LOWER(status) = LOWER(?)';
      return `${k} = ?`;
    });
    if (table === 'funcionarios' && (req.query.apenasAtivos === 'true' || req.query.ativo === 'true')) {
      whereParts.push("(status IS NULL OR LOWER(status) != 'inativo')");
    }
    const where = whereParts.length ? ' WHERE ' + whereParts.join(' AND ') : '';
    db.all(`SELECT * FROM ${table}${where} ORDER BY id DESC`, Object.values(filters), (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(row => saida(req, row)));
    });
  });

  // GET ONE
  app.get(`/api/${table}/:id`, (req, res) => {
    db.get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Registro não encontrado.' });
      res.json(saida(req, row));
    });
  });

  // CREATE (o id nunca vem do usuário: é gerado pelo banco)
  app.post(`/api/${table}`, async (req, res) => {
    const data = pickColumns(table, req.body);
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Nenhum dado enviado.' });

    try {
      const erroFuncionario = await validarFuncionarioAtivo(table, data);
      if (erroFuncionario) return res.status(400).json({ error: erroFuncionario });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    if (table === 'funcionarios' && !data.status) data.status = 'Ativo';

    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;

    db.run(sql, Object.values(data), async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const newId = this.lastID;
      try { await aposSalvar(table, newId, req); } catch (e) { console.error(e.message); }

      const camposCadastrados = Object.entries(data)
        .filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'senha' && k !== 'foto' && k !== 'fotos')
        .map(([k, v]) => ({ campo: k, valor: v }));

      const detalhesPayload = JSON.stringify({
        tipo: 'criacao',
        resumo: `Novo registro #${newId} cadastrado no módulo ${table}`,
        campos: camposCadastrados,
      });

      logAudit(quem(req), 'Criação', table, newId, detalhesPayload, req);
      res.json(saida(req, { id: newId, ...data }));
    });
  });

  // UPDATE (o id não pode ser alterado)
  app.put(`/api/${table}/:id`, async (req, res) => {
    const data = pickColumns(table, req.body);
    // A senha não volta para a tela: campo vazio na edição mantém a senha atual
    if (table === 'funcionarios' && !data.senha) delete data.senha;
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Nenhum dado enviado.' });

    try {
      const erroFuncionario = await validarFuncionarioAtivo(table, data);
      if (erroFuncionario) return res.status(400).json({ error: erroFuncionario });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    // Busca o registro atual antes da alteração para calcular o diff exato campo a campo
    const registroAnterior = await get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);

    const sql = `UPDATE ${table} SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`;

    db.run(sql, [...Object.values(data), req.params.id], async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      try { await aposSalvar(table, Number(req.params.id), req); } catch (e) { console.error(e.message); }

      const mudancas = [];
      if (registroAnterior) {
        keys.forEach(k => {
          if (k === 'id' || k === 'senha' || k === 'foto' || k === 'fotos') return;
          const valAntigo = registroAnterior[k];
          const valNovo = data[k];
          const a = (valAntigo === null || valAntigo === undefined) ? '' : String(valAntigo).trim();
          const b = (valNovo === null || valNovo === undefined) ? '' : String(valNovo).trim();
          if (a !== b) {
            mudancas.push({
              campo: k,
              de: valAntigo !== null && valAntigo !== undefined && valAntigo !== '' ? String(valAntigo) : null,
              para: valNovo !== null && valNovo !== undefined && valNovo !== '' ? String(valNovo) : null,
            });
          }
        });
      }

      const detalhesPayload = JSON.stringify({
        tipo: 'alteracao',
        resumo: mudancas.length > 0
          ? `${mudancas.length} campo(s) alterado(s) no módulo ${table}`
          : `Registro #${req.params.id} atualizado no módulo ${table}`,
        mudancas: mudancas,
      });

      logAudit(quem(req), 'Alteração', table, Number(req.params.id), detalhesPayload, req);
      res.json(saida(req, { id: Number(req.params.id), ...data }));
    });
  });

  // DELETE
  app.delete(`/api/${table}/:id`, async (req, res) => {
    try {
      const blocked = [];
      for (const [child, column, label, where] of deleteGuards[table] || []) {
        const row = await get(`SELECT COUNT(*) as total FROM ${child} WHERE ${where || `${column} = ?`}`, [req.params.id]);
        if (row && row.total > 0) blocked.push(`${row.total} ${label}`);
      }
      if (blocked.length) {
        return res.status(409).json({ error: `Não é possível excluir este registro, pois ele possui restrições ou vínculos: ${blocked.join(', ')}.` });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    const registroAntesExcluir = await get(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);

    db.run(`DELETE FROM ${table} WHERE id=?`, [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const dadosExcluidos = registroAntesExcluir
        ? Object.entries(registroAntesExcluir)
            .filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'senha' && k !== 'foto' && k !== 'fotos')
            .map(([k, v]) => ({ campo: k, valor: v }))
        : [];

      const identificador = registroAntesExcluir
        ? (registroAntesExcluir.nome || registroAntesExcluir.titulo || registroAntesExcluir.descricao || `#${req.params.id}`)
        : `#${req.params.id}`;

      const detalhesPayload = JSON.stringify({
        tipo: 'exclusao',
        resumo: `Registro "${identificador}" excluído do módulo ${table}`,
        dados: dadosExcluidos,
      });

      logAudit(quem(req), 'Exclusão', table, Number(req.params.id), detalhesPayload, req);
      res.json({ deleted: this.changes });
    });
  });
});

// Login do protótipo: a senha não é conferida.
// E-mail de um funcionário cadastrado -> entra com o perfil dele; qualquer outro (ou vazio) -> Visitante.
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  try {
    const encontrado = email ? await get('SELECT id, status, nome FROM funcionarios WHERE LOWER(email) = LOWER(?)', [email]) : null;
    if (encontrado && String(encontrado.status).toLowerCase() === 'inativo') {
      return res.status(403).json({ error: `O funcionário "${encontrado.nome}" está inativo e não pode acessar o sistema.` });
    }
    const userId = encontrado?.id || await idVisitante();
    if (!userId) return res.status(500).json({ error: 'Usuário Visitante não encontrado. Rode o seed do banco (node seed.js).' });

    const sessao = await carregarSessao(userId);
    return res.json({ success: true, token: gerarToken(userId), ...sessao });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Dados do usuário logado e permissões atualizadas (o frontend consulta ao abrir o sistema)
app.get('/api/auth/me', (req, res) => res.json(req.sessao));

// Dashboard Analytics Route
app.get('/api/dashboard', async (req, res) => {
  const queries = {
    totalClientes: 'SELECT COUNT(*) as v FROM clientes',
    totalProprietarios: 'SELECT COUNT(*) as v FROM proprietarios',
    totalImoveis: 'SELECT COUNT(*) as v FROM imoveis',
    valorPortfolio: 'SELECT COALESCE(SUM(precoVenda), 0) as v FROM imoveis',
    receitaMes: "SELECT COALESCE(SUM(valor), 0) as v FROM financeiro WHERE status='Pago' AND tipo='Receita'",
    despesaMes: "SELECT COALESCE(SUM(valor), 0) as v FROM financeiro WHERE status='Pago' AND (tipo='Despesa' OR tipo='Repasse')",
    repassesPendentes: "SELECT COALESCE(SUM(valor), 0) as v FROM financeiro WHERE status='Pendente' AND tipo='Repasse'",
    visitasPendentes: "SELECT COUNT(*) as v FROM visitas WHERE status='Pendente'",
    negociacoesAndamento: "SELECT COUNT(*) as v FROM negociacoes WHERE status='Em Andamento'",
    totalNegociacoes: "SELECT COUNT(*) as v FROM negociacoes",
    contratosAtivos: "SELECT COUNT(*) as v FROM contratos WHERE status='Ativo'",
    totalContratos: "SELECT COUNT(*) as v FROM contratos",
    totalNotificacoes: "SELECT COUNT(*) as v FROM notificacoes",
    notificacoesAtivas: "SELECT COUNT(*) as v FROM notificacoes WHERE status='Ativo'",
  };
  try {
    const stats = {};
    for (const [key, sql] of Object.entries(queries)) stats[key] = (await get(sql)).v;
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
// Banco vazio (primeira execução ou Render após um deploy): preenche com dados de teste de todos os módulos
const prepararBanco = async () => {
  await db.pronto;
  if ((await get('SELECT COUNT(*) as c FROM funcionarios')).c === 0) {
    console.log('Banco vazio: gerando dados de teste...');
    await popularDadosDeTeste(db);
    console.log('Dados de teste gerados.');
  }
  await garantirAcessosPadrao();
};

prepararBanco()
  .catch(err => console.error('Erro ao preparar o banco:', err.message))
  .finally(() => app.listen(PORT, () => console.log('Backend Urbânia rodando na porta ' + PORT)));
