import { useState } from 'react';
import { FilterSelect, SearchInput, matches } from './DataTable';

export type SearchField<T> = { value: string; label: string; get: (row: T) => unknown };

// "a, b ou c"
const listar = (itens: string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} ou ${itens[itens.length - 1]}` : itens[0] ?? '');

// ComboBox que escolhe o campo + busca aplicada sobre ele
export function useFieldSearch<T>(fields: SearchField<T>[]) {
  const [campo, setCampo] = useState('');
  const [term, setTerm] = useState('');
  // Campo escolhido no combobox antes de clicar em "Buscar": o texto de ajuda da busca acompanha na hora
  const [campoEscolhido, setCampoEscolhido] = useState('');

  const filter = (row: T) => {
    if (!term) return true;
    if (campo) {
      const f = fields.find(x => x.value === campo);
      return f ? matches(term, f.get(row)) : true;
    }
    return fields.some(f => matches(term, f.get(row)));
  };

  const selectedField = fields.find(f => f.value === campoEscolhido);
  const placeholder = selectedField
    ? `Buscar por ${selectedField.label.toLowerCase()}...`
    : `Buscar por ${listar(fields.map(f => f.label.toLowerCase()))}...`;

  const controls = (
    <>
      <SearchInput value={term} onChange={setTerm} placeholder={placeholder} />
      <FilterSelect
        value={campo}
        onChange={v => setCampo(v || '')}
        onDraftChange={setCampoEscolhido}
        placeholder="Todos os campos"
        options={fields.map(f => ({ value: f.value, label: f.label }))}
      />
    </>
  );

  return { filter, controls, term, setTerm, campo, setCampo };
}
