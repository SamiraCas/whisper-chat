import React from 'react';
import { Mic, Square, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioRecorder, RecordingState } from '@/hooks/useAudioRecorder';

/**
 * COMPONENTE: AudioRecorder
 * 
 * ============================================
 * RESPONSABILIDADE
 * ============================================
 * 
 * Componente de UI para gravação de áudio com:
 * - Botão principal de ação (gravar/parar)
 * - Visualização de ondas de áudio
 * - Indicador de duração
 * - Feedback visual por estado
 * 
 * SEPARAÇÃO DE RESPONSABILIDADES:
 * - useAudioRecorder: Lógica de gravação (hook)
 * - AudioRecorder: Apresentação visual (componente)
 * 
 * Esta separação facilita:
 * - Testes unitários
 * - Reutilização da lógica
 * - Manutenção do código
 */

interface AudioRecorderProps {
  /** Callback quando gravação termina */
  onRecordingComplete: (audioBlob: Blob) => void;
  /** Se está processando externamente */
  isProcessing?: boolean;
  /** Duração máxima em segundos */
  maxDuration?: number;
}

/**
 * Formata segundos para mm:ss
 */
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Mapeia estado para variante de botão
 */
const getButtonVariant = (state: RecordingState, isProcessing: boolean) => {
  if (isProcessing) return 'processing';
  switch (state) {
    case 'recording':
      return 'recording';
    case 'requesting':
    case 'processing':
      return 'processing';
    case 'error':
      return 'destructive';
    default:
      return 'primary-glow';
  }
};

/**
 * Mapeia estado para texto do botão
 */
const getButtonLabel = (state: RecordingState, isProcessing: boolean): string => {
  if (isProcessing) return 'Processando...';
  switch (state) {
    case 'idle':
      return 'Gravar Áudio';
    case 'requesting':
      return 'Solicitando...';
    case 'recording':
      return 'Parar Gravação';
    case 'processing':
      return 'Processando...';
    case 'error':
      return 'Tentar Novamente';
    default:
      return 'Gravar';
  }
};

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  isProcessing = false,
  maxDuration = 60,
}) => {
  const {
    state,
    error,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    reset,
    volumeLevel,
  } = useAudioRecorder(maxDuration);

  // Efeito para notificar quando gravação completa
  React.useEffect(() => {
    if (state === 'processing' && audioBlob) {
      onRecordingComplete(audioBlob);
    }
  }, [state, audioBlob, onRecordingComplete]);

  /**
   * Handler do botão principal
   * 
   * Comportamento baseado no estado:
   * - idle/error: Inicia gravação
   * - recording: Para gravação
   * - processing: Aguarda
   */
  const handleMainAction = () => {
    switch (state) {
      case 'idle':
      case 'error':
        startRecording();
        break;
      case 'recording':
        stopRecording();
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Visualização de Ondas de Áudio */}
      <div className="relative flex items-center justify-center gap-1 h-16">
        {state === 'recording' ? (
          // Barras de áudio animadas baseadas no volume
          Array.from({ length: 9 }).map((_, i) => {
            const delay = i * 0.1;
            const baseHeight = 20;
            const maxHeight = 64;
            const height = baseHeight + (volumeLevel * (maxHeight - baseHeight) * (0.5 + Math.random() * 0.5));
            
            return (
              <div
                key={i}
                className="w-1.5 rounded-full bg-recording transition-all duration-100"
                style={{
                  height: `${height}px`,
                  animationDelay: `${delay}s`,
                  opacity: 0.4 + volumeLevel * 0.6,
                }}
              />
            );
          })
        ) : (
          // Estado inativo - barras estáticas
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-4 rounded-full bg-muted transition-all duration-300"
              style={{
                opacity: state === 'processing' || isProcessing ? 0.6 : 0.3,
              }}
            />
          ))
        )}

        {/* Indicador de processamento */}
        {(state === 'processing' || isProcessing) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-processing animate-spin" />
          </div>
        )}
      </div>

      {/* Duração */}
      <div className="font-mono text-2xl tabular-nums tracking-wider">
        <span className={state === 'recording' ? 'text-recording' : 'text-muted-foreground'}>
          {formatDuration(duration)}
        </span>
        <span className="text-muted-foreground/50 ml-2">
          / {formatDuration(maxDuration)}
        </span>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-4">
        <Button
          variant={getButtonVariant(state, isProcessing)}
          size="xl"
          onClick={handleMainAction}
          disabled={state === 'requesting' || state === 'processing' || isProcessing}
          className="min-w-[200px]"
        >
          {state === 'recording' ? (
            <Square className="w-5 h-5 fill-current" />
          ) : (state === 'processing' || isProcessing) ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
          {getButtonLabel(state, isProcessing)}
        </Button>

        {/* Botão de Reset */}
        {(state === 'error' || (state === 'processing' && !isProcessing)) && (
          <Button
            variant="glass"
            size="icon-lg"
            onClick={reset}
            title="Resetar"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm max-w-md text-center animate-fade-in">
          {error}
        </div>
      )}

      {/* Dica de uso */}
      {state === 'idle' && (
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Clique no botão para começar a gravar. Seu áudio será transcrito automaticamente.
        </p>
      )}
    </div>
  );
};
