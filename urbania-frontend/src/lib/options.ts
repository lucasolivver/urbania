import type { FieldDef } from '../components/EntityForm';
import { maskCep } from './masks';

// Opções dos ComboBox, conforme o Documento de Requisitos
export const TIPOS_CLIENTE = ['Comprador', 'Locatário', 'Interessado'];
export const ORIGENS_CLIENTE = ['Site', 'Indicação', 'Redes Sociais', 'Telefone'];
export const FINALIDADES_BUSCA = ['Compra', 'Locação', 'Todos'];
export const TIPOS_IMOVEL_BUSCA = ['Apartamento', 'Casa', 'Sobrado', 'Cobertura', 'Chácara', 'Sala Comercial'];
export const TIPOS_IMOVEL = ['Apartamento', 'Casa', 'Cobertura', 'Studio', 'Kitnet', 'Chácara', 'Sala Comercial'];
export const FINALIDADES_IMOVEL = ['Venda', 'Aluguel', 'Venda e Aluguel', 'Temporada'];
export const TIPOS_PESSOA = ['Física', 'Jurídica'];
export const TIPOS_CONTA = ['Corrente', 'Poupança'];
export const SEXOS = ['Masculino', 'Feminino', 'Outro'];
export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];
export const STATUS_VISITA = ['Pendente', 'Confirmada', 'Realizada', 'Cancelada'];
export const STATUS_NEGOCIACAO = ['Em Andamento', 'Realizada', 'Convertida em Contrato', 'Cancelada'];
export const TIPOS_NEGOCIACAO = ['Venda', 'Locação', 'Temporada'];
export const FORMAS_PAGAMENTO = [
  'À Vista (PIX / Transferência)',
  'Financiamento Bancário',
  'Parcelamento Direto com Proprietário',
  'Carta de Crédito / Consórcio',
  'Permuta Parcial',
  'Outro',
];
export const CARGOS = ['Corretor', 'Secretária', 'Gerente', 'Financeiro', 'Administrador'];
export const STATUS_FUNCIONARIO = ['Ativo', 'Inativo'];
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Campos de endereço usados em várias telas. O CEP preenche o restante automaticamente.
export const addressFields = (required = false): FieldDef[] => [
  { key: 'cep', label: 'CEP', mask: maskCep, placeholder: '00000-000', cep: true, required },
  { key: 'logradouro', label: 'Logradouro', required },
  { key: 'numero', label: 'Número', required },
  { key: 'complemento', label: 'Complemento' },
  { key: 'bairro', label: 'Bairro', required },
  { key: 'cidade', label: 'Cidade', required },
  { key: 'uf', label: 'Estado', type: 'select', options: UFS, required },
];

// Cores das etiquetas de status
export const statusColor = (status: unknown) => ({
  Pendente: 'bg-amber-100 text-amber-700',
  Confirmada: 'bg-emerald-100 text-emerald-700',
  Realizada: 'bg-slate-200 text-slate-700',
  Cancelada: 'bg-red-100 text-red-700',
  Ativo: 'bg-emerald-100 text-emerald-700',
  Inativo: 'bg-red-100 text-red-700',
  'Em Andamento': 'bg-sky-100 text-sky-700',
  Finalizado: 'bg-indigo-100 text-indigo-700',
  Rescindido: 'bg-rose-100 text-rose-700',
  Pago: 'bg-emerald-100 text-emerald-700',
  Atrasado: 'bg-rose-100 text-rose-700',
  Receita: 'bg-emerald-100 text-emerald-700',
  Despesa: 'bg-rose-100 text-rose-700',
  Repasse: 'bg-sky-100 text-sky-700',
  Contestado: 'bg-orange-100 text-orange-700',
  'Convertida em Contrato': 'bg-violet-100 text-violet-700',
}[String(status)] || 'bg-slate-100 text-slate-600');

// Notificações e Automações (RF F13-F16)
export const GATILHOS_NOTIFICACAO = [
  'Novo Cliente Cadastrado',
  'Visita Agendada',
  'Visita Confirmada',
  'Proposta/Negociação Recebida',
  'Proposta Aceita',
  'Contrato Assinado',
  'Vencimento de Aluguel (3 dias antes)',
  'Aluguel em Atraso',
  'Repasse Realizado ao Proprietário',
  'Orçamento de Reparo Solicitado',
];
export const CANAIS_NOTIFICACAO = ['WhatsApp', 'E-mail', 'SMS'];
export const CHIPS_NOTIFICACAO = [
  '{NomeCliente}',
  '{NomeProprietario}',
  '{Imovel}',
  '{Endereco}',
  '{Data}',
  '{Hora}',
  '{Valor}',
  '{Corretor}',
  '{ChavePix}',
];
export const DESTINATARIOS_NOTIFICACAO = ['Cliente', 'Proprietário', 'Corretor', 'Todos'];

// Financeiro e Despesas (RF F1-F4 Despesas / F72 Efetuar Pagamento)
export const TIPOS_FINANCEIRO = ['Receita', 'Despesa', 'Repasse'];
export const STATUS_FINANCEIRO = ['Pendente', 'Pago', 'Atrasado', 'Cancelado'];
export const CATEGORIAS_FINANCEIRO = [
  'Aluguel de Imóvel',
  'Comissão de Venda',
  'Taxa de Administração',
  'Repasse ao Proprietário',
  'Manutenção e Reparo',
  'Marketing e Divulgação',
  'Administrativa',
  'Pessoal e Salários',
  'Impostos e Taxas',
  'Serviços Terceirizados',
  'Outros',
];
export const FORMAS_PAGAMENTO_FINANCEIRO = [
  'Boleto Bancário',
  'PIX',
  'Transferência Bancária',
  'Cartão de Crédito',
  'Débito em Conta',
  'Retenção Automática',
  'Dinheiro',
];

// Contratos (Locação, Venda e Temporada)
export const TIPOS_CONTRATO = ['Locação', 'Compra e Venda', 'Temporada'];
export const STATUS_CONTRATO = ['Ativo', 'Pendente', 'Finalizado', 'Rescindido', 'Cancelado'];
export const FINALIDADES_CONTRATO = ['Residencial', 'Comercial', 'Temporada', 'Industrial / Rural'];
export const FORMAS_PAGAMENTO_CONTRATO = ['Boleto Bancário', 'PIX', 'Transferência Bancária', 'Débito em Conta', 'Dinheiro'];
export const TIPOS_GARANTIA = [
  'Caução em Dinheiro',
  'Fiador',
  'Seguro Fiança',
  'Título de Capitalização',
  'Sem Garantia / Não Aplicável',
];
export const INDICES_REAJUSTE = ['IGP-M', 'IPCA', 'INPC', 'Fixo (Sem Reajuste)'];

// Manutenção (Serviços, Prestadores, Reparos) e Divulgação (Canais, Anúncios)
export const CATEGORIAS_SERVICO = ['Elétrica', 'Hidráulica', 'Pintura', 'Alvenaria', 'Marcenaria', 'Serralheria', 'Limpeza', 'Jardinagem', 'Climatização', 'Outros'];
export const TIPOS_CHAVE_PIX = ['CPF', 'CNPJ', 'E-mail', 'Celular', 'Chave Aleatória'];
export const STATUS_REPARO = ['Pendente', 'Iniciado', 'Finalizado'];
export const TIPOS_CANAL = ['Site', 'Impresso', 'Anunciado'];
export const SITUACOES_ANUNCIO = ['Ativo', 'Pausado', 'Encerrado'];

// Controle de Despesas (RF F1-F4 Despesas)
export const CATEGORIAS_DESPESA = [
  'Administrativa',
  'Pessoal',
  'Marketing',
  'Manutenção de imóveis sob gestão',
  'Impostos e taxas',
  'Serviços terceirizados',
  'Outros',
];
export const STATUS_DESPESA = ['Pendente', 'Pago', 'Atrasado'];

// Gestão de Multas (RF F1-F4 Multas)
export const TIPOS_MULTA = [
  'Atraso no pagamento',
  'Rescisão antecipada',
  'Dano ao imóvel',
  'Quebra de cláusula',
  'Outros',
];
export const STATUS_MULTA = ['Pendente', 'Contestado', 'Pago', 'Cancelado'];
export const MODOS_VALOR_MULTA = ['Fixo (R$)', 'Percentual (%)'];

// Perfis de Acesso (RF F9-F12)
export const STATUS_PERFIL = ['Ativo', 'Inativo'];

export interface ModuloSistemaDef {
  id: string;
  label: string;
  categoria: string;
  descricao: string;
  acoes: string[];
}

export const MODULOS_SISTEMA: ModuloSistemaDef[] = [
  { id: 'clientes', label: 'Clientes', categoria: 'Operações Imobiliárias', descricao: 'Cadastro, consulta e perfil de interesse de clientes', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'proprietarios', label: 'Proprietários', categoria: 'Operações Imobiliárias', descricao: 'Cadastro de proprietários e dados bancários para repasse', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'imoveis', label: 'Imóveis', categoria: 'Operações Imobiliárias', descricao: 'Portfólio de imóveis, precificação e galeria de fotos', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'visitas', label: 'Visitas', categoria: 'Operações Imobiliárias', descricao: 'Agendamento de visitas com clientes e corretores', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'negociacoes', label: 'Negociações', categoria: 'Operações Imobiliárias', descricao: 'Propostas de compra, venda e locação', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'contratos', label: 'Contratos', categoria: 'Operações Imobiliárias', descricao: 'Contratos de locação e compra/venda, garantias e termos', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'financeiro', label: 'Financeiro', categoria: 'Gestão Financeira', descricao: 'Fluxo de caixa, recebimentos de aluguel e comissões', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'despesas', label: 'Controle de Despesas', categoria: 'Gestão Financeira', descricao: 'Despesas administrativas e de imóveis sob gestão', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'multas', label: 'Gestão de Multas', categoria: 'Gestão Financeira', descricao: 'Aplicação e controle de multas contratuais e atrasos', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'relatorios', label: 'Relatórios', categoria: 'Gestão e Segurança', descricao: 'Relatórios gerenciais e indicadores', acoes: ['Visualizar'] },
  { id: 'auditoria', label: 'Auditoria de Acessos', categoria: 'Gestão e Segurança', descricao: 'Logs de login e de alterações feitas no sistema', acoes: ['Visualizar'] },
  { id: 'servicos', label: 'Serviços', categoria: 'Manutenção', descricao: 'Catálogo de serviços de manutenção', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'prestadores', label: 'Prestadores', categoria: 'Manutenção', descricao: 'Prestadores de serviço e dados de pagamento', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'reparos', label: 'Reparos', categoria: 'Manutenção', descricao: 'Ordens de reparo dos imóveis', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'canais', label: 'Canais de Publicação', categoria: 'Divulgação', descricao: 'Portais e redes onde os imóveis são anunciados', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'anuncios', label: 'Anúncios', categoria: 'Divulgação', descricao: 'Anúncios de imóveis nos canais de publicação', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'notificacoes', label: 'Notificações', categoria: 'Administração', descricao: 'Régua de notificações e automações via WhatsApp/E-mail', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'funcionarios', label: 'Funcionários', categoria: 'Administração', descricao: 'Gestão de equipe, corretores e colaboradores', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'perfis', label: 'Perfis de Acesso', categoria: 'Administração', descricao: 'Níveis de permissões e controle de acessos da equipe', acoes: ['Visualizar', 'Criar', 'Editar', 'Excluir'] },
  { id: 'configuracoes', label: 'Configurações', categoria: 'Administração', descricao: 'Dados da imobiliária e parâmetros financeiros', acoes: ['Visualizar', 'Editar'] },
];

