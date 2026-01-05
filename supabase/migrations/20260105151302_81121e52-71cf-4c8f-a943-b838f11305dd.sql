-- Tabela Pessoa para o desafio de backend DAO
-- Esta tabela armazena dados de pessoas com campos para busca otimizada

CREATE TABLE public.pessoa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  data_nascimento DATE,
  endereco TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para otimizar buscas (findByEmail, findByTelefone, findByName)
CREATE INDEX idx_pessoa_email ON public.pessoa (email);
CREATE INDEX idx_pessoa_telefone ON public.pessoa (telefone);
CREATE INDEX idx_pessoa_nome ON public.pessoa USING gin(to_tsvector('portuguese', nome));

-- Enable RLS para segurança
ALTER TABLE public.pessoa ENABLE ROW LEVEL SECURITY;

-- Política pública para leitura (demonstração)
-- Em produção, isso seria restrito por auth.uid()
CREATE POLICY "Permitir leitura pública para demonstração"
ON public.pessoa
FOR SELECT
USING (true);

-- Política para inserção pública (demonstração)
CREATE POLICY "Permitir inserção para demonstração"
ON public.pessoa
FOR INSERT
WITH CHECK (true);

-- Política para atualização pública (demonstração)
CREATE POLICY "Permitir atualização para demonstração"
ON public.pessoa
FOR UPDATE
USING (true);

-- Política para deleção pública (demonstração)
CREATE POLICY "Permitir deleção para demonstração"
ON public.pessoa
FOR DELETE
USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_pessoa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_pessoa_updated_at
BEFORE UPDATE ON public.pessoa
FOR EACH ROW
EXECUTE FUNCTION public.update_pessoa_updated_at();

-- Inserir alguns dados de exemplo para teste
INSERT INTO public.pessoa (nome, email, telefone, data_nascimento, endereco) VALUES
('João Silva', 'joao.silva@email.com', '11999998888', '1990-05-15', 'Rua das Flores, 123'),
('Maria Santos', 'maria.santos@email.com', '11988887777', '1985-10-20', 'Av. Brasil, 456'),
('Pedro Oliveira', 'pedro.oliveira@email.com', '11977776666', '1992-03-08', 'Rua do Sol, 789');