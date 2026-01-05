import React from 'react';
import { FileText, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * COMPONENTE: TranscriptViewer
 * 
 * ============================================
 * RESPONSABILIDADE
 * ============================================
 * 
 * Exibe a transcrição do áudio gravado com:
 * - Área de texto formatada
 * - Botão para copiar
 * - Estado de carregamento
 * - Animação de aparição
 * 
 * DECISÕES DE UX:
 * - Fonte mono para texto técnico
 * - Fundo glass para destaque sutil
 * - Feedback visual ao copiar
 */

interface TranscriptViewerProps {
  /** Texto transcrito */
  transcript: string | null;
  /** Se está carregando a transcrição */
  isLoading?: boolean;
  /** Título personalizado */
  title?: string;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  transcript,
  isLoading = false,
  title = 'Transcrição',
}) => {
  const [copied, setCopied] = React.useState(false);

  /**
   * Copia texto para clipboard
   * 
   * Usa a API Clipboard moderna com fallback
   * para navegadores mais antigos
   */
  const handleCopy = async () => {
    if (!transcript) return;

    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      toast.success('Texto copiado!');
      
      // Reset do estado após 2 segundos
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback para navegadores antigos
      const textArea = document.createElement('textarea');
      textArea.value = transcript;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      toast.success('Texto copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Não renderiza se não há conteúdo e não está carregando
  if (!transcript && !isLoading) {
    return null;
  }

  return (
    <div className="w-full rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{title}</span>
        </div>

        {transcript && (
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
      <div className="p-4 min-h-[100px] max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="w-5 h-5 text-processing animate-spin" />
            <span className="text-muted-foreground">Transcrevendo áudio...</span>
          </div>
        ) : (
          <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {transcript}
          </p>
        )}
      </div>
    </div>
  );
};
