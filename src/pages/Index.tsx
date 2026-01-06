import React from 'react';
import {
  Mic,
  Database,
  Sparkles,
  Zap,
  Brain,
} from 'lucide-react';

import { AudioRecorder } from '@/components/AudioRecorder';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { ChatResponse } from '@/components/ChatResponse';
import { PessoaManager } from '@/components/PessoaManager';
import { processVoiceChat } from '@/services/openai';
import { toast } from 'sonner';

type ActiveTab = 'voice' | 'dao';

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('voice');

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<string | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob) => {
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

      setTranscript(result.transcript);
      setIsTranscribing(false);
      setIsGenerating(true);

      await new Promise((r) => setTimeout(r, 300));

      setResponse(result.response);
      setIsGenerating(false);

      toast.success('Áudio processado com sucesso');
    } catch (err) {
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur bg-card/70 border-b border-border/50">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary to-accent blur-md opacity-30" />
            </div>

            <div>
              <h1 className="text-lg font-bold sm:text-xl text-gradient">
                DataCrazy Challenge
              </h1>
              <p className="text-xs text-muted-foreground">
                Voice AI + Backend Demo
              </p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-2 overflow-x-auto sm:overflow-visible rounded-xl bg-card border border-border/50 p-1">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'voice'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Mic className="w-4 h-4" />
              Voice
            </button>

            <button
              onClick={() => setActiveTab('dao')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'dao'
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Database className="w-4 h-4" />
              DAO
            </button>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-10">
        {activeTab === 'voice' ? (
          <div className="space-y-10">
            {/* HERO */}
            <section className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-primary">Powered by OpenAI Whisper</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-bold text-gradient">
                Voice to AI Chat
              </h2>

              <p className="text-muted-foreground max-w-xl mx-auto">
                Grave sua voz, veja a transcrição em tempo real e receba uma
                resposta inteligente da IA.
              </p>
            </section>

            {/* AUDIO */}
            <section className="flex justify-center">
              <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                <AudioRecorder
                  onRecordingComplete={handleRecordingComplete}
                  isProcessing={isProcessing}
                  maxDuration={60}
                />
              </div>
            </section>

            {/* RESULTADOS */}
            <section className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <TranscriptViewer
                  transcript={transcript}
                  isLoading={isTranscribing}
                  title="Transcrição"
                />
              </div>

              <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
                <ChatResponse
                  response={response}
                  isLoading={isGenerating}
                  streaming
                />
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-10">
            <section className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-sm">
                <Brain className="w-4 h-4 text-accent" />
                <span className="text-accent">Backend + Cache</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-gradient">
                DAO com Cache Inteligente
              </h2>

              <p className="text-muted-foreground max-w-xl mx-auto">
                Camada DAO com cache em memória, TTL e invalidação automática.
              </p>
            </section>

            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              <PessoaManager />
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/50 bg-card/50 py-6">
        <div className="container max-w-6xl mx-auto px-4 text-center text-xs sm:text-sm text-muted-foreground">
          DataCrazy Technical Challenge • React + TypeScript
        </div>
      </footer>
    </div>
  );
};

export default Index;
