import React from 'react';
import {
  Mic,
  Database,
  Sparkles,
  Code2,
  Zap,
  Brain,
} from 'lucide-react';

import { AudioRecorder } from '@/components/AudioRecorder';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { ChatResponse } from '@/components/ChatResponse';
import { PessoaManager } from '@/components/PessoaManager';
import { processVoiceChat } from '@/services/openai'; // ← service correto
import { toast } from 'sonner';

type ActiveTab = 'voice' | 'dao';

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('voice');

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<string | null>(null);

  /**
   * CALLBACK PRINCIPAL
   * Esse método PRECISA disparar toda vez que o áudio termina
   */
  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log('[Index] handleRecordingComplete DISPAROU', {
      size: audioBlob?.size,
      type: audioBlob?.type,
    });

    if (!audioBlob || audioBlob.size === 0) {
      toast.error('Áudio inválido');
      return;
    }

    setIsProcessing(true);
    setIsTranscribing(true);
    setIsGenerating(false);
    setTranscript(null);
    setResponse(null);

    try {
      const result = await processVoiceChat(audioBlob);

      console.log('[Index] Resultado do backend:', result);

      setTranscript(result.transcript);
      setIsTranscribing(false);

      setIsGenerating(true);

      // pequeno delay apenas para UX
      await new Promise((r) => setTimeout(r, 300));

      setResponse(result.response);
      setIsGenerating(false);

      toast.success('Áudio processado com sucesso');
    } catch (err) {
      console.error('[Index] Erro ao processar áudio:', err);

      toast.error(
        err instanceof Error
          ? err.message
          : 'Erro inesperado ao processar áudio'
      );

      setIsTranscribing(false);
      setIsGenerating(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-br from-primary to-accent rounded-xl blur-md opacity-30" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">
                DataCrazy Challenge
              </h1>
              <p className="text-xs text-muted-foreground">
                Front-end + Backend Demo
              </p>
            </div>
          </div>

          <nav className="flex gap-1 p-1 rounded-xl bg-card/80 border border-border/50">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'voice'
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Mic className="w-4 h-4" />
              Voice Chat
            </button>

            <button
              onClick={() => setActiveTab('dao')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dao'
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Database className="w-4 h-4" />
              DAO + Cache
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'voice' ? (
          <div className="space-y-8">
            {/* HERO */}
            <section className="text-center space-y-4 py-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-primary">Powered by Lovable AI</span>
              </div>

              <h2 className="text-4xl font-bold text-gradient">
                Voice to AI Chat
              </h2>

              <p className="text-muted-foreground max-w-lg mx-auto">
                Grave sua voz, receba a transcrição e uma resposta inteligente da IA.
              </p>
            </section>

            {/* AUDIO */}
            <section className="py-8">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
                maxDuration={60}
              />
            </section>

            {/* RESULTADOS */}
            <section className="grid gap-6">
              <TranscriptViewer
                transcript={transcript}
                isLoading={isTranscribing}
                title="Sua Transcrição"
              />

              <ChatResponse
                response={response}
                isLoading={isGenerating}
                streaming
              />
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="text-center space-y-4 py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-sm">
                <Brain className="w-4 h-4 text-accent" />
                <span className="text-accent">Prisma + Cache SHA256</span>
              </div>

              <h2 className="text-3xl font-bold text-gradient">
                Backend DAO + Cache
              </h2>

              <p className="text-muted-foreground max-w-lg mx-auto">
                Demonstração da camada DAO com cache e invalidação.
              </p>
            </section>

            <PessoaManager />
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur py-6">
        <div className="container max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          DataCrazy Technical Challenge • React + TypeScript
        </div>
      </footer>
    </div>
  );
};

export default Index;
