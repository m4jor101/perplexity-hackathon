import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from './components/ui/button';
import { Icon } from '@iconify/react';
import { sonarModels, type Model } from './lib/models';
import { loadSettings, saveSettings } from './lib/storage';
import { SettingsDialog } from './components/ui/settings-dialog';
import { cn } from './lib/utils';
import { Message } from './components/Message';
import { ModelSelector } from './components/ModelSelector';
import { useAutoResizeTextarea } from './hooks/useAutoResizeTextarea';
import { processAIResponse, type Message as MessageType } from './lib/api';
import './types/chrome.d.ts';

interface UserMessage extends MessageType {
  role: 'user';
}

interface AssistantMessage extends MessageType {
  role: 'assistant';
  isStreaming?: boolean;
}

type ConversationMessage = UserMessage | AssistantMessage;

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model>(sonarModels[0]);
  const [apiKey, setApiKey] = useState<string>('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([
    { role: 'assistant', content: 'Hi! How can I help you today?' }
  ]);
  const [quotedText, setQuotedText] = useState<string>('');
  const useStreaming = true;

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useAutoResizeTextarea(textareaRef, prompt);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversation]);

  // Load settings
  useEffect(() => {
    loadSettings().then((settings) => {
      if (settings.perplexityApiKey) {
        setApiKey(settings.perplexityApiKey);
      }
      if (settings.selectedModelId) {
        const model = sonarModels.find(m => m.id === settings.selectedModelId);
        if (model) setSelectedModel(model);
      }
    });
  }, []);

  // Chrome message handling for text selection
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === 'updateSelectedText') {
        setQuotedText(message.text);
        if (message.insertImmediately) {
          handleSubmit(new Event('submit') as any);
        }
      }
    };

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  const handleModelChange = useCallback((model: Model) => {
    setSelectedModel(model);
    saveSettings({ selectedModelId: model.id });
  }, []);

  const resetConversation = useCallback(() => {
    setConversation([
      { role: 'assistant', content: 'Hi! How can I help you today?' }
    ]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!prompt.trim() && !quotedText) || loading || !apiKey) return;

    setLoading(true);
    try {
      const userMessage = quotedText
        ? prompt.trim() ? `${quotedText}\n\n${prompt.trim()}` : quotedText
        : prompt.trim();

      // Reset input states
      setPrompt('');
      setQuotedText('');

      // Add user message
      setConversation(prev => [...prev, { role: 'user', content: userMessage }]);

      // Add streaming placeholder if needed
      if (useStreaming) {
        setConversation(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);
      }

      // Filter messages for API call and ensure they follow Perplexity API requirements
      const conversationHistory = conversation.filter(msg => !('isStreaming' in msg));

      try {
        // Process response
        const response = await processAIResponse(
          userMessage,
          conversationHistory,
          selectedModel.id,
          apiKey,
          useStreaming ? (text) => {
            setConversation(prev => {
              const newConv = [...prev];
              const lastMsg = newConv[newConv.length - 1];
              if (lastMsg.role === 'assistant' && 'isStreaming' in lastMsg) {
                lastMsg.content = text;
              }
              return newConv;
            });
          } : undefined,
          (error) => {
            console.error('API Error:', error);
            const errorMessage = error instanceof SyntaxError
              ? `JSON Syntax Error: ${error.message}. This might be caused by special characters in your message.`
              : `Error: ${error.message || 'Failed to get response'}`;

            setConversation(prev => [
              ...prev.filter(msg => !('isStreaming' in msg)),
              { role: 'assistant', content: errorMessage }
            ]);
          }
        );

        // Update conversation with final response
        setConversation(prev => {
          const newConv = prev.filter(msg => !('isStreaming' in msg));
          return [...newConv, {
            role: 'assistant',
            content: response.text,
            citations: response.citations
          }];
        });
      } catch (apiError) {
        // Handle JSON parsing errors specifically
        const errorMessage = apiError instanceof SyntaxError
          ? `JSON Syntax Error: Please try rephrasing your message to avoid special characters.`
          : `Error: ${apiError instanceof Error ? apiError.message : 'An unexpected error occurred'}`;

        setConversation(prev => [
          ...prev.filter(msg => !('isStreaming' in msg)),
          { role: 'assistant', content: errorMessage }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
      setConversation(prev => [
        ...prev.filter(msg => !('isStreaming' in msg)),
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <ModelSelector
          selectedModel={selectedModel}
          models={sonarModels}
          onModelChange={handleModelChange}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={resetConversation}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon="material-symbols:add" className="h-4 w-4" />
          </Button>
          <SettingsDialog />
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {conversation.map((message, index) => (
          <Message
            key={index}
            message={message}
            showReasoning={true}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {quotedText && (
            <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setQuotedText('')}
                className="absolute right-2 top-2 h-6 w-6"
              >
                <Icon icon="material-symbols:close" className="h-4 w-4" />
              </Button>
              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Selected Text</div>
              <div className="text-sm text-gray-700 dark:text-gray-200">{quotedText}</div>
            </div>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={apiKey ? "Ask anything..." : "Please add your Perplexity API key in settings"}
              className={cn(
                "w-full px-4 py-3 pr-12",
                "rounded-lg resize-none",
                "bg-background border border-input",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "placeholder:text-muted-foreground",
                "min-h-[44px] max-h-[200px]",
                !apiKey && "opacity-50"
              )}
              disabled={loading || !apiKey}
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !apiKey || (!prompt.trim() && !quotedText)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            >
              <Icon icon="material-symbols:send" className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
