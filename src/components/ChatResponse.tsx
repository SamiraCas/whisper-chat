import React from 'react';
import { Bot, Copy, Check, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * COMPONENTE: ChatResponse
 * 
 * ============================================
 * RESPONSABILIDADE
 * ============================================
 * 
 * Exibe a resposta gerada pela IA (ChatGPT) com:
 * - Avatar estilizado do bot
 * - Formatação de markdown básica
 * - Botão para copiar
 * - Estado de carregamento com animação
 * - Efeito de digitação opcional
 * 
 * DECISÕES DE UX:
 * - Borda com gradiente para destaque
 * - Animação suave de aparição
 * - Indicador visual de IA
 */

interface ChatResponseProps {
  /** Resposta da IA */
  response: string | null;
  /** Se está carregando a resposta */
  isLoading?: boolean;
  /** Se deve animar como digitação */
  streaming?: boolean;
}

export const ChatResponse: React.FC<ChatResponseProps> = ({
  response,
  isLoading = false,
  streaming = false,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [displayedText, setDisplayedText] = React.useState('');

  /**
   * Efeito de digitação para resposta streaming
   * 
   * Simula o efeito de texto sendo digitado
   * para melhor experiência visual
   */
  React.useEffect(() => {
    if (!streaming || !response) {
      setDisplayedText(response || '');
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      if (index < response.length) {
        setDisplayedText(response.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 15); // 15ms por caractere

    return () => clearInterval(interval);
  }, [response, streaming]);

  const handleCopy = async () => {
    if (!response) return;

    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      toast.success('Resposta copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  // Não renderiza se não há conteúdo e não está carregando
  if (!response && !isLoading) {
    return null;
  }

  return (
    <div className="w-full rounded-xl overflow-hidden animate-fade-in relative">
      {/* Borda com gradiente */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 -z-10 blur-sm opacity-50" />
      
      <div className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-xl m-px">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3">
            {/* Avatar do Bot */}
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              {/* Indicador de ativo */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
            </div>
            
            <div>
              <span className="font-medium text-sm flex items-center gap-1.5">
                Assistente IA
                <Sparkles className="w-3 h-3 text-accent" />
              </span>
              <span className="text-xs text-muted-foreground">
                Powered by Lovable AI
              </span>
            </div>
          </div>

          {response && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-success" />
                  <span className="text-success">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 min-h-[120px] max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="relative">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <div className="absolute inset-0 blur-md bg-accent/30 rounded-full" />
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Gerando resposta...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Analisando sua transcrição
                </p>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {streaming ? displayedText : response}
                {streaming && displayedText !== response && (
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
