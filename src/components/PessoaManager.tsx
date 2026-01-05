import React from 'react';
import { User, Search, Plus, Edit, Trash2, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * COMPONENTE: PessoaManager
 * 
 * ============================================
 * DEMONSTRAÇÃO DO DAO + CACHE
 * ============================================
 * 
 * Interface para gerenciar a entidade Pessoa,
 * demonstrando as operações do DAO com cache.
 * 
 * FUNCIONALIDADES:
 * - Listagem de pessoas
 * - Busca por nome, email, telefone
 * - CRUD completo
 * - Visualização de estatísticas do cache
 */

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  created_at: string;
  updated_at: string;
}

interface CacheStats {
  size: number;
  keys: string[];
}

export const PessoaManager: React.FC = () => {
  const [pessoas, setPessoas] = React.useState<Pessoa[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchType, setSearchType] = React.useState<'nome' | 'email' | 'telefone'>('nome');
  const [searchValue, setSearchValue] = React.useState('');
  const [cacheStats, setCacheStats] = React.useState<CacheStats | null>(null);
  const [searchResult, setSearchResult] = React.useState<Pessoa | Pessoa[] | null>(null);

  /**
   * Carrega lista de pessoas
   */
  const loadPessoas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pessoa-dao', {
        method: 'GET',
      });

      if (error) throw error;
      
      setPessoas(data?.data || []);
      setCacheStats(data?.cache || null);
    } catch (err) {
      console.error('Erro ao carregar pessoas:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Busca por campo específico
   */
  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error('Digite um valor para buscar');
      return;
    }

    setLoading(true);
    setSearchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('pessoa-dao', {
        method: 'GET',
        body: null,
        headers: {},
      });

      // Fazemos a busca com query params via URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pessoa-dao?search=${searchType}&value=${encodeURIComponent(searchValue)}`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      setSearchResult(result.data);
      setCacheStats(result.cache || null);
      
      if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
        toast.info('Nenhum resultado encontrado');
      } else {
        toast.success(`Busca realizada! Cache: ${result.cache?.size || 0} entradas`);
      }
    } catch (err) {
      console.error('Erro na busca:', err);
      toast.error('Erro ao buscar');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Deleta uma pessoa
   */
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar?')) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pessoa-dao/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      toast.success('Pessoa removida com sucesso!');
      loadPessoas();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast.error('Erro ao deletar');
    }
  };

  React.useEffect(() => {
    loadPessoas();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <User className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Gestão de Pessoas</h2>
            <p className="text-sm text-muted-foreground">DAO + Cache com SHA256</p>
          </div>
        </div>

        <Button onClick={loadPessoas} variant="glass" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}
        </Button>
      </div>

      {/* Cache Stats */}
      {cacheStats && (
        <div className="px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-primary font-medium">Cache:</span>
            <span className="text-foreground">{cacheStats.size} entradas</span>
            {cacheStats.keys.length > 0 && (
              <span className="text-muted-foreground font-mono text-xs">
                ({cacheStats.keys.slice(0, 3).join(', ')}...)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as 'nome' | 'email' | 'telefone')}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary"
        >
          <option value="nome">Nome</option>
          <option value="email">Email (SQL + Cache)</option>
          <option value="telefone">Telefone (SQL + Cache)</option>
        </select>

        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={`Buscar por ${searchType}...`}
          className="flex-1 px-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:border-primary"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />

        <Button onClick={handleSearch} disabled={loading}>
          <Search className="w-4 h-4" />
          Buscar
        </Button>
      </div>

      {/* Search Results */}
      {searchResult && (
        <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-accent" />
            Resultado da Busca
          </h3>
          <pre className="text-xs font-mono overflow-auto max-h-40 text-foreground/80">
            {JSON.stringify(searchResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Lista de Pessoas */}
      <div className="space-y-3">
        {loading && pessoas.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : pessoas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma pessoa cadastrada
          </div>
        ) : (
          pessoas.map((pessoa) => (
            <div
              key={pessoa.id}
              className="p-4 rounded-xl bg-card/80 backdrop-blur border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-medium text-lg">{pessoa.nome}</h3>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {pessoa.email}
                    </span>
                    
                    {pessoa.telefone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {pessoa.telefone}
                      </span>
                    )}
                    
                    {pessoa.endereco && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {pessoa.endereco}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pessoa.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
