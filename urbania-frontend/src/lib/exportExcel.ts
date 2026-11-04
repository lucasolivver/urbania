import * as XLSX from 'xlsx';
import { contatoEmpresa, dadosEmpresa, dataHoraEmissao, nomeEmpresa } from './identidade';
import { useAuth } from './auth';
import { useConfig } from './config';

type Celula = string | number | null | undefined;

export function exportGridToXlsx(
  headers: string[],
  rows: Celula[][],
  filename: string,
  cabecalho: string[] = [] // linhas de identificação acima da tabela (imobiliária, título, emissão)
) {
  try {
    const topo = cabecalho.length ? [...cabecalho.map(l => [l]), []] : [];
    const data = [...topo, headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Ajustar largura automática das colunas
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map(r => String(r[i] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
    });
    ws['!cols'] = colWidths;
    // Cada linha de identificação ocupa a largura da tabela
    if (cabecalho.length && headers.length > 1) {
      ws['!merges'] = cabecalho.map((_, r) => ({ s: { r, c: 0 }, e: { r, c: headers.length - 1 } }));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    if (cabecalho.length) wb.Props = { Company: cabecalho[0] };

    // Gerar ArrayBuffer 100% puro no browser sem depender de fs/Node
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn('Falha no exportador nativo .xlsx, usando fallback CSV:', err);
    exportGridToCsv(headers, rows, filename, cabecalho);
  }
}

// Utilitário de exportação CSV como fallback
export function exportGridToCsv(
  headers: string[],
  rows: Celula[][],
  filename: string,
  cabecalho: string[] = []
) {
  const celula = (cell: Celula) => (cell === null || cell === undefined ? '' : `"${String(cell).replace(/"/g, '""')}"`);
  const sanitizedRows = rows.map(r => r.map(celula).join(';'));
  const topo = cabecalho.length ? [...cabecalho.map(celula), ''] : [];
  const csvContent = '﻿' + [...topo, headers.join(';'), ...sanitizedRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exportação de planilha já com a identidade da imobiliária no topo (a mesma do relatório impresso)
export function useExportarPlanilha() {
  const { config } = useConfig();
  const { user } = useAuth();
  return (titulo: string, headers: string[], rows: Celula[][], filename: string) =>
    exportGridToXlsx(headers, rows, filename, [
      nomeEmpresa(config),
      dadosEmpresa(config),
      titulo,
      `Emitido em ${dataHoraEmissao()}${user?.nome ? ` por ${user.nome}` : ''}`,
      contatoEmpresa(config),
    ].filter(Boolean));
}
