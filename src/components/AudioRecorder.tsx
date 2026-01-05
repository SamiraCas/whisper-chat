import React from 'react';
import { Mic, Square, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioRecorder, RecordingState } from '@/hooks/useAudioRecorder';

interface AudioRecorderProps {
  /** Callback chamado quando o áudio estiver FINALIZADO */
  onRecordingComplete: (audioBlob: Blob) => void;
  /** Indica processamento externo (ex: chamada API) */
  isProcessing?: boolean;
  /** Duração máxima da gravação */
  maxDuration?: number;
}

/* ===============================
 * Utils
 * =============================== */

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
};

const getButtonVariant = (
  state: RecordingState,
  isProcessing: boolean
) => {
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

const getButtonLabel = (
  state: RecordingState,
  isProcessing: boolean
): string => {
  if (isProcessing) return 'Processando...';
  switch (state) {
    case 'idle':
      return 'Gravar Áudio';
    case 'requesting':
      return 'Solicitando...';
    case 'recording':
      return 'Parar Gravação';
    case 'processing':
      return 'Finalizando áudio...';
    case 'error':
      return 'Tentar Novamente';
    default:
      return 'Gravar';
  }
};

/* ===============================
 * Component
 * =============================== */

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

  /**
   * 🔒 Flag de segurança
   * Garante que o áudio seja enviado UMA ÚNICA VEZ
   */
  const hasSentRef = React.useRef(false);

  /**
   * ✅ PONTO CRÍTICO CORRIGIDO
   *
   * O áudio só é enviado quando:
   * - state === 'processing'
   * - audioBlob existe
   * - ainda não foi enviado
   */
  React.useEffect(() => {
    if (
      state === 'processing' &&
      audioBlob &&
      audioBlob.size > 0 &&
      !hasSentRef.current
    ) {
      hasSentRef.current = true;

      console.log('[AudioRecorder] Áudio pronto para envio', {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      onRecordingComplete(audioBlob);
    }
  }, [state, audioBlob, onRecordingComplete]);

  /**
   * Reset da flag quando usuário reinicia
   */
  React.useEffect(() => {
    if (state === 'idle') {
      hasSentRef.current = false;
    }
  }, [state]);

  /**
   * Ação principal do botão
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
      {/* ===============================
       * Visualização de ondas
       * =============================== */}
      <div className="relative flex items-center justify-center gap-1 h-16">
        {state === 'recording' ? (
          Array.from({ length: 9 }).map((_, i) => {
            const height = 20 + volumeLevel * 44;
            return (
              <div
                key={i}
                className="w-1.5 rounded-full bg-recording transition-all duration-100"
                style={{ height }}
              />
            );
          })
        ) : (
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-4 rounded-full bg-muted"
              style={{ opacity: 0.4 }}
            />
          ))
        )}

        {(state === 'processing' || isProcessing) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-processing animate-spin" />
          </div>
        )}
      </div>

      {/* ===============================
       * Duração
       * =============================== */}
      <div className="font-mono text-2xl tabular-nums">
        <span
          className={
            state === 'recording'
              ? 'text-recording'
              : 'text-muted-foreground'
          }
        >
          {formatDuration(duration)}
        </span>
        <span className="text-muted-foreground/50 ml-2">
          / {formatDuration(maxDuration)}
        </span>
      </div>

      {/* ===============================
       * Botões
       * =============================== */}
      <div className="flex items-center gap-4">
        <Button
          variant={getButtonVariant(state, isProcessing)}
          size="xl"
          onClick={handleMainAction}
          disabled={
            state === 'requesting' ||
            state === 'processing' ||
            isProcessing
          }
          className="min-w-[200px]"
        >
          {state === 'recording' ? (
            <Square className="w-5 h-5 fill-current" />
          ) : state === 'processing' || isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
          {getButtonLabel(state, isProcessing)}
        </Button>

        {(state === 'error' ||
          (state === 'processing' && !isProcessing)) && (
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

      {/* ===============================
       * Erro
       * =============================== */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* ===============================
       * Dica
       * =============================== */}
      {state === 'idle' && (
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Clique no botão para começar a gravar. Seu áudio será transcrito
          automaticamente.
        </p>
      )}
    </div>
  );
};
