import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'escuro';
const CHAVE = 'urbania_tema';

// Tema salvo neste navegador (o index.html já aplica a classe antes do React, para não "piscar" claro)
const lerTema = (): Tema => {
  try {
    return localStorage.getItem(CHAVE) === 'escuro' ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
};

// Impressão / PDF sempre no tema claro: a identidade visual dos relatórios não depende do tema da tela.
// Vale para o botão "Imprimir" e para o Ctrl+P; ao fechar a impressão o tema escolhido volta.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', () => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  });
  window.addEventListener('afterprint', () => {
    const escuro = lerTema() === 'escuro';
    document.documentElement.classList.toggle('dark', escuro);
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
  });
}

// Tema claro/escuro: liga a classe .dark no <html> (ver @custom-variant dark e theme-dark.css)
export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
    document.documentElement.style.colorScheme = tema === 'escuro' ? 'dark' : 'light';
    try { localStorage.setItem(CHAVE, tema); } catch { /* navegador sem armazenamento */ }
  }, [tema]);

  return { tema, alternar: () => setTema(t => (t === 'escuro' ? 'claro' : 'escuro')) };
}
