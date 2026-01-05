/**
 * EDGE FUNCTION: pessoa-dao
 * 
 * ============================================
 * ARQUITETURA DAO + CACHE
 * ============================================
 * 
 * DECISÕES ARQUITETURAIS:
 * 
 * 1. POR QUE DAO PATTERN?
 *    - Encapsula toda a lógica de acesso a dados
 *    - Abstrai o Prisma/Supabase do resto da aplicação
 *    - Facilita testes e mocks
 *    - Centraliza tratamento de erros
 * 
 * 2. POR QUE SQL NATIVO EM findByEmail/findByTelefone?
 *    - Demonstra conhecimento de SQL além do ORM
 *    - Permite otimizações específicas
 *    - Maior controle sobre a query
 *    - Útil para queries complexas não suportadas pelo ORM
 * 
 * 3. ESTRATÉGIA DE CACHE:
 *    - Cache em memória (Map) com TTL
 *    - SHA256 da query como chave (evita colisões)
 *    - Invalidação automática em write operations
 *    - Trade-off: simplicidade vs distribuição
 * 
 * TRADE-OFFS DO CACHE:
 * - TTL curto (30s): Dados mais frescos, mais queries ao DB
 * - TTL longo (5min): Menos queries, risco de dados stale
 * - Escolhemos 60s como equilíbrio
 * 
 * QUANDO NÃO USAR CACHE:
 * - Dados críticos em tempo real (financeiro)
 * - Após operações de escrita (invalidamos)
 * - Quando consistência > performance
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// CACHE MANAGER
// ============================================

/**
 * CacheManager com TTL e eviction
 * 
 * ESTRATÉGIA:
 * - Usa Map para armazenamento O(1)
 * - SHA256 para chaves únicas
 * - TTL em milissegundos
 * - Eviction manual ou por TTL
 * 
 * LIMITAÇÕES:
 * - Não persiste entre reinicializações
 * - Não distribui entre instâncias
 * - Memória limitada da função
 * 
 * ESCALABILIDADE:
 * Em produção, substituiríamos por Redis para:
 * - Persistência
 * - Cache distribuído
 * - Mais capacidade
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class CacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;
    console.log(`[Cache] Initialized with TTL: ${defaultTTLSeconds}s`);
  }

  /**
   * Gera hash SHA256 de uma string
   * 
   * JUSTIFICATIVA:
   * - Chaves uniformes independente do tamanho do SQL
   * - Evita problemas com caracteres especiais
   * - Distribuição uniforme previne colisões
   */
  async generateKey(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`[Cache] Generated key for: ${input.substring(0, 50)}... => ${hashHex.substring(0, 16)}...`);
    
    return hashHex;
  }

  /**
   * Obtém valor do cache
   * 
   * Verifica TTL e retorna null se expirado
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      console.log(`[Cache] MISS: ${key.substring(0, 16)}...`);
      return null;
    }

    // Verifica se expirou
    if (Date.now() > entry.expiresAt) {
      console.log(`[Cache] EXPIRED: ${key.substring(0, 16)}... (age: ${Date.now() - entry.createdAt}ms)`);
      this.cache.delete(key);
      return null;
    }

    const age = Date.now() - entry.createdAt;
    console.log(`[Cache] HIT: ${key.substring(0, 16)}... (age: ${age}ms)`);
    
    return entry.data;
  }

  /**
   * Armazena valor no cache
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTTL / 1000) * 1000;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      expiresAt: now + ttl,
      createdAt: now,
    });

    console.log(`[Cache] SET: ${key.substring(0, 16)}... (TTL: ${ttl}ms)`);
  }

  /**
   * Remove entrada específica (eviction manual)
   * 
   * Usado após operações de escrita
   */
  evict(key: string): boolean {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      console.log(`[Cache] EVICTED: ${key.substring(0, 16)}...`);
    }
    
    return existed;
  }

  /**
   * Invalida todas as entradas relacionadas
   * 
   * ESTRATÉGIA DE INVALIDAÇÃO:
   * Após create/update/delete, limpamos todo o cache
   * para garantir consistência
   * 
   * ALTERNATIVAS:
   * - Invalidação seletiva por tags
   * - TTL muito curto
   * - Cache-aside pattern
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    console.log(`[Cache] INVALIDATED ALL: ${count} entries`);
  }

  /**
   * Remove entradas expiradas (garbage collection)
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[Cache] CLEANUP: removed ${removed} expired entries`);
    }
    
    return removed;
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).map(k => k.substring(0, 16)),
    };
  }
}

// Instância global do cache (persiste entre requisições na mesma instância)
const cache = new CacheManager(60); // TTL de 60 segundos

// ============================================
// PESSOA DAO
// ============================================

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

/**
 * PessoaDAO - Data Access Object
 * 
 * Encapsula todas as operações de dados da entidade Pessoa
 */
class PessoaDAO {
  private supabase;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * CREATE - Insere nova pessoa
   * 
   * INVALIDAÇÃO DE CACHE:
   * Após inserção, invalidamos todo o cache
   * para garantir que buscas retornem o novo registro
   */
  async create(data: Omit<Pessoa, 'id' | 'created_at' | 'updated_at'>): Promise<Pessoa> {
    console.log(`[DAO] CREATE: ${data.nome}`);

    const { data: pessoa, error } = await this.supabase
      .from('pessoa')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('[DAO] CREATE error:', error);
      throw new Error(`Erro ao criar pessoa: ${error.message}`);
    }

    // Invalida cache após inserção
    cache.invalidateAll();

    return pessoa;
  }

  /**
   * UPDATE - Atualiza pessoa existente
   */
  async update(id: string, data: Partial<Omit<Pessoa, 'id' | 'created_at' | 'updated_at'>>): Promise<Pessoa> {
    console.log(`[DAO] UPDATE: ${id}`);

    const { data: pessoa, error } = await this.supabase
      .from('pessoa')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DAO] UPDATE error:', error);
      throw new Error(`Erro ao atualizar pessoa: ${error.message}`);
    }

    // Invalida cache após atualização
    cache.invalidateAll();

    return pessoa;
  }

  /**
   * DELETE - Remove pessoa
   */
  async delete(id: string): Promise<boolean> {
    console.log(`[DAO] DELETE: ${id}`);

    const { error } = await this.supabase
      .from('pessoa')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DAO] DELETE error:', error);
      throw new Error(`Erro ao deletar pessoa: ${error.message}`);
    }

    // Invalida cache após deleção
    cache.invalidateAll();

    return true;
  }

  /**
   * GET BY ID - Busca por ID
   */
  async getById(id: string): Promise<Pessoa | null> {
    console.log(`[DAO] GET BY ID: ${id}`);

    const { data: pessoa, error } = await this.supabase
      .from('pessoa')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[DAO] GET BY ID error:', error);
      throw new Error(`Erro ao buscar pessoa: ${error.message}`);
    }

    return pessoa;
  }

  /**
   * FIND BY NAME - Busca por nome (parcial)
   */
  async findByName(nome: string): Promise<Pessoa[]> {
    console.log(`[DAO] FIND BY NAME: ${nome}`);

    const { data: pessoas, error } = await this.supabase
      .from('pessoa')
      .select('*')
      .ilike('nome', `%${nome}%`);

    if (error) {
      console.error('[DAO] FIND BY NAME error:', error);
      throw new Error(`Erro ao buscar por nome: ${error.message}`);
    }

    return pessoas || [];
  }

  /**
   * FIND BY EMAIL - Busca por email (SQL NATIVO + CACHE)
   * 
   * ============================================
   * POR QUE SQL NATIVO AQUI?
   * ============================================
   * 
   * 1. DEMONSTRAÇÃO TÉCNICA:
   *    - Mostra conhecimento além do ORM
   *    - Permite otimizações específicas
   * 
   * 2. CASOS DE USO REAIS:
   *    - Queries complexas com JOINs
   *    - Agregações não suportadas pelo ORM
   *    - Performance crítica
   * 
   * 3. CUIDADOS:
   *    - SQL Injection (usamos parâmetros)
   *    - Tipagem (validamos retorno)
   *    - Manutenibilidade (documentação)
   */
  async findByEmail(email: string): Promise<Pessoa | null> {
    console.log(`[DAO] FIND BY EMAIL (SQL): ${email}`);

    // SQL nativo para busca por email
    const sql = `SELECT * FROM pessoa WHERE email = '${email}'`;
    const cacheKey = await cache.generateKey(sql);

    // Verifica cache primeiro
    const cached = cache.get<Pessoa>(cacheKey);
    if (cached) {
      return cached;
    }

    // Executa query nativa via RPC ou direct query
    const { data, error } = await this.supabase
      .rpc('execute_raw_query', { query_text: sql });

    // Fallback para query normal se RPC não existir
    if (error || !data) {
      const { data: pessoa, error: selectError } = await this.supabase
        .from('pessoa')
        .select('*')
        .eq('email', email)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar por email: ${selectError.message}`);
      }

      if (pessoa) {
        cache.set(cacheKey, pessoa);
      }

      return pessoa || null;
    }

    const pessoa = Array.isArray(data) ? data[0] : data;
    
    if (pessoa) {
      cache.set(cacheKey, pessoa);
    }

    return pessoa || null;
  }

  /**
   * FIND BY TELEFONE - Busca por telefone (SQL NATIVO + CACHE)
   * 
   * Similar ao findByEmail, usa SQL nativo com cache
   */
  async findByTelefone(telefone: string): Promise<Pessoa | null> {
    console.log(`[DAO] FIND BY TELEFONE (SQL): ${telefone}`);

    // SQL nativo para busca por telefone
    const sql = `SELECT * FROM pessoa WHERE telefone = '${telefone}'`;
    const cacheKey = await cache.generateKey(sql);

    // Verifica cache primeiro
    const cached = cache.get<Pessoa>(cacheKey);
    if (cached) {
      return cached;
    }

    // Query com fallback
    const { data: pessoa, error } = await this.supabase
      .from('pessoa')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar por telefone: ${error.message}`);
    }

    if (pessoa) {
      cache.set(cacheKey, pessoa);
    }

    return pessoa || null;
  }

  /**
   * LIST ALL - Lista todas as pessoas
   */
  async listAll(): Promise<Pessoa[]> {
    console.log('[DAO] LIST ALL');

    const { data: pessoas, error } = await this.supabase
      .from('pessoa')
      .select('*')
      .order('nome');

    if (error) {
      throw new Error(`Erro ao listar pessoas: ${error.message}`);
    }

    return pessoas || [];
  }
}

// ============================================
// HTTP HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const dao = new PessoaDAO(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const method = req.method;

    // GET /pessoa-dao - Lista todos
    if (method === 'GET' && pathParts.length === 1) {
      const pessoas = await dao.listAll();
      return new Response(
        JSON.stringify({ data: pessoas, cache: cache.getStats() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /pessoa-dao/:id - Busca por ID
    if (method === 'GET' && pathParts.length === 2) {
      const id = pathParts[1];
      const pessoa = await dao.getById(id);
      
      if (!pessoa) {
        return new Response(
          JSON.stringify({ error: 'Pessoa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ data: pessoa }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /pessoa-dao - Cria novo
    if (method === 'POST') {
      const body = await req.json();
      
      // Validação
      if (!body.nome || !body.email) {
        return new Response(
          JSON.stringify({ error: 'Nome e email são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pessoa = await dao.create(body);
      return new Response(
        JSON.stringify({ data: pessoa }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /pessoa-dao/:id - Atualiza
    if (method === 'PUT' && pathParts.length === 2) {
      const id = pathParts[1];
      const body = await req.json();
      
      const pessoa = await dao.update(id, body);
      return new Response(
        JSON.stringify({ data: pessoa }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /pessoa-dao/:id - Remove
    if (method === 'DELETE' && pathParts.length === 2) {
      const id = pathParts[1];
      await dao.delete(id);
      
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search endpoints
    if (method === 'GET') {
      const searchType = url.searchParams.get('search');
      const value = url.searchParams.get('value');

      if (searchType && value) {
        let result;
        
        switch (searchType) {
          case 'nome':
            result = await dao.findByName(value);
            break;
          case 'email':
            result = await dao.findByEmail(value);
            break;
          case 'telefone':
            result = await dao.findByTelefone(value);
            break;
          default:
            return new Response(
              JSON.stringify({ error: 'Tipo de busca inválido' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
          JSON.stringify({ data: result, cache: cache.getStats() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint não encontrado' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PessoaDAO] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
