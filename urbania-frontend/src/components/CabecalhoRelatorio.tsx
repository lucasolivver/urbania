import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useConfig } from '../lib/config';
import { contatoEmpresa, dadosEmpresa, dataHoraEmissao, nomeEmpresa } from '../lib/identidade';
import logoPadrao from '../assets/logo.png';

// Cabeçalho e rodapé que só aparecem na impressão / PDF (classe print-only), iguais em qualquer tema.
// Cores fixas em estilo inline para não herdar as regras genéricas de impressão (h1, p, badges).
export function CabecalhoRelatorio({ titulo }: { titulo?: string }) {
  const { config } = useConfig();
  const { user } = useAuth();
  // A data/hora de emissão é a do momento da impressão, não a de quando a tela abriu
  const [emitidoEm, setEmitidoEm] = useState(dataHoraEmissao);
  useEffect(() => {
    const atualizar = () => setEmitidoEm(dataHoraEmissao());
    window.addEventListener('beforeprint', atualizar);
    return () => window.removeEventListener('beforeprint', atualizar);
  }, []);

  const navy = '#0a2540';
  const dados = dadosEmpresa(config);
  const contato = contatoEmpresa(config);

  return (
    <div className="print-only relatorio-cabecalho" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingBottom: 10, borderBottom: `3px solid ${navy}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={config.logo || logoPadrao} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '15pt', fontWeight: 800, color: navy, lineHeight: 1.15 }}>{nomeEmpresa(config)}</div>
            {dados && <div style={{ fontSize: '8pt', color: '#475569' }}>{dados}</div>}
            {contato && <div style={{ fontSize: '8pt', color: '#475569' }}>{contato}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {titulo && <div style={{ fontSize: '11pt', fontWeight: 700, color: navy }}>{titulo}</div>}
          <div style={{ fontSize: '8pt', color: '#475569' }}>Emitido em {emitidoEm}</div>
          {user?.nome && <div style={{ fontSize: '8pt', color: '#475569' }}>por {user.nome}</div>}
        </div>
      </div>
    </div>
  );
}

export function RodapeRelatorio() {
  const { config } = useConfig();
  return (
    <div className="print-only relatorio-rodape" style={{ marginTop: 12, paddingTop: 6, borderTop: '1px solid #cbd5e1', fontSize: '7.5pt', color: '#64748b', textAlign: 'center' }}>
      {nomeEmpresa(config)}{dadosEmpresa(config) ? ` · ${dadosEmpresa(config)}` : ''} · Documento gerado pelo sistema Urbânia
    </div>
  );
}
