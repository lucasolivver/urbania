import type { Config } from './config';

// Identidade da imobiliária (Configurações) usada em todo relatório impresso, PDF ou planilha
export const nomeEmpresa = (config: Config) => config.nomeFantasia || 'Urbânia';
export const dadosEmpresa = (config: Config) => [
  config.razaoSocial,
  config.cnpj && `CNPJ ${config.cnpj}`,
  config.creci && `CRECI ${config.creci}`,
].filter(Boolean).join(' · ');
export const contatoEmpresa = (config: Config) => [config.telefone, config.email, config.site].filter(Boolean).join(' · ');

export const dataHoraEmissao = (d = new Date()) =>
  `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
