import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { Icon } from '@iconify/react';
import { Citation } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

// Custom CSS for citation badges
const citationBadgeStyles = `
  .citation-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(59, 130, 246, 0.1);
    color: rgb(59, 130, 246);
    padding: 0 4px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    text-decoration: none;
    margin: 0 1px;
    cursor: pointer;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .citation-badge:hover {
    background-color: rgba(59, 130, 246, 0.2);
    color: rgb(29, 78, 216);
  }
  
  .dark .citation-badge {
    background-color: rgba(96, 165, 250, 0.15);
    color: rgb(147, 197, 253);
    border-color: rgba(96, 165, 250, 0.3);
  }
  
  .dark .citation-badge:hover {
    background-color: rgba(96, 165, 250, 0.25);
    color: rgb(191, 219, 254);
  }
`;

type MessageProps = {
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: Citation[];
    reasoning?: string;
    isStreaming?: boolean;
  };
  showReasoning?: boolean;
};

export function Message({ message, showReasoning = true }: MessageProps) {
  const isUser = message.role === 'user';
  const [processedContent, setProcessedContent] = useState(message.content);
  const [extractedReasoning, setExtractedReasoning] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Use both explicit reasoning and extracted reasoning from <think> tags
  const reasoning = extractedReasoning || message.reasoning;
  const hasReasoning = Boolean((reasoning && reasoning.trim()));
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  // Only show reasoning controls for assistant messages with reasoning content
  const showReasoningControls = !isUser && hasReasoning && showReasoning;

  // Process content to extract <think> tags when content changes
  useEffect(() => {
    if (message.role !== 'assistant' || !message.content) return;

    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const matches = [...message.content.matchAll(thinkRegex)];

    if (matches.length > 0) {
      // Extract all reasoning blocks
      const reasoningBlocks = matches.map(match => match[1].trim()).join('\n\n');
      setExtractedReasoning(reasoningBlocks);

      // Remove the <think> tags from displayed content
      let cleanedContent = message.content.replace(thinkRegex, '').trim();
      setProcessedContent(cleanedContent);
    } else {
      // No <think> tags found, use original content
      setProcessedContent(message.content);
    }
  }, [message.content, message.role]);

  // Convert citation references like [1] into clickable links
  const transformCitationReferences = (text: string) => {
    if (!message.citations || message.citations.length === 0) {
      return text;
    }

    // Replace [n] with clickable badges instead of standard markdown links
    const citationRegex = /\[(\d+)\]/g;

    try {
      return text.replace(citationRegex, (match, citationNumber) => {
        const index = parseInt(citationNumber, 10) - 1;
        if (index >= 0 && message.citations && index < message.citations.length) {
          // Create a custom span element with citation styling
          return `<sup><a href="${message.citations[index].url}" target="_blank" rel="noopener noreferrer" class="citation-badge">[${citationNumber}]</a></sup>`;
        }
        return match;
      });
    } catch (error) {
      console.error('Error transforming citation references:', error);
      return text; // Return original text if transformation fails
    }
  };

  const toggleReasoning = () => {
    setIsReasoningExpanded(prev => !prev);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Process content for citation references when citations change
  useEffect(() => {
    if (message.role === 'assistant' && message.citations && message.citations.length > 0) {
      setProcessedContent(transformCitationReferences(processedContent));
    }
  }, [message.citations, processedContent]);

  const hasCitations = message.citations && message.citations.length > 0;

  return (
    <div className={cn(
      "px-4 py-6 border-b border-border",
      "transition-colors duration-200",
      isUser ? "bg-secondary/50" : "bg-background"
    )}>
      {/* Inject the citation badge CSS */}
      {!isUser && <style dangerouslySetInnerHTML={{ __html: citationBadgeStyles }} />}

      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center",
            isUser ? "bg-blue-600" : "bg-gray-600"
          )}>
            <Icon
              icon={isUser ? "heroicons:user" : "heroicons:sparkles"}
              className="w-3.5 h-3.5 text-white"
            />
          </div>
          <span className="font-medium">
            {isUser ? "You" : "Assistant"}
          </span>

          {/* Citation toggle button */}
          {!isUser && hasCitations && (
            <button
              onClick={() => setShowCitations(prev => !prev)}
              className="ml-auto text-xs flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
            >
              <Icon icon={showCitations ? "heroicons:book-open" : "heroicons:book-open"} className="w-3.5 h-3.5" />
              {showCitations ? "Hide Sources" : "Show Sources"}
            </button>
          )}
        </div>

        <div className="pl-6">
          {/* Reasoning section */}
          {showReasoningControls && (
            <div className="mt-4 text-sm text-muted-foreground">
              <button
                onClick={toggleReasoning}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Icon icon={isReasoningExpanded ? "heroicons:chevron-down" : "heroicons:chevron-right"}
                  className="w-4 h-4" />
                Reasoning
              </button>

              {isReasoningExpanded && reasoning && (
                <div className="mt-2 pl-6 border-l-2 border-border">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                    {reasoning}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}

          {isUser ? (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">
              {message.content}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {processedContent ? (
                <React.Fragment>
                  {/* Added a safety wrapper in case ReactMarkdown fails */}
                  {(() => {
                    try {
                      return (
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // Customize how different markdown elements are rendered
                            p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed text-zinc-800 dark:text-zinc-100">{children}</p>,
                            ul: ({ children }) => <ul className="mb-4 list-disc pl-5 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-4 list-decimal pl-5 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="mb-1 leading-relaxed text-zinc-800 dark:text-zinc-100">{children}</li>,
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 text-zinc-900 dark:text-zinc-50">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 text-zinc-900 dark:text-zinc-50">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-md font-bold mb-2 mt-4 text-zinc-900 dark:text-zinc-50">{children}</h3>,
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {children}
                              </a>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-300 pl-4 italic my-4 text-gray-700 dark:text-gray-300">
                                {children}
                              </blockquote>
                            ),
                            code: ({ inline, className, children, ...props }: any) => {
                              const codeRef = useRef<HTMLElement>(null);
                              const codeString = String(children).replace(/\n$/, '');

                              if (inline) {
                                return (
                                  <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-pink-500 dark:text-pink-400" {...props}>
                                    {children}
                                  </code>
                                );
                              }

                              return (
                                <div className="relative group bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden my-4">
                                  <div className="flex items-center justify-between px-4 py-1 bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                                    <span>{className?.replace(/language-/, '') || 'code'}</span>
                                    <button
                                      onClick={() => handleCopyCode(codeString)}
                                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                                    >
                                      {copiedCode === codeString ? (
                                        <Icon icon="heroicons:check" className="w-4 h-4" />
                                      ) : (
                                        <Icon icon="heroicons:clipboard" className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-4 overflow-x-auto">
                                    <code ref={codeRef} className="text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  </pre>
                                </div>
                              );
                            },
                            // Add table component styling
                            table: ({ children }) => (
                              <div className="my-6 w-full overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-700">
                                <table className="w-full border-collapse table-auto">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-gray-100 dark:bg-gray-800">
                                {children}
                              </thead>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {children}
                              </tbody>
                            ),
                            tr: ({ children }) => (
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100 border-r border-gray-300 dark:border-gray-700 last:border-r-0">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                                {children}
                              </td>
                            )
                          }}
                        >
                          {processedContent}
                        </ReactMarkdown>
                      );
                    } catch (error) {
                      console.error('Error rendering markdown:', error);
                      // Fallback to plain text if markdown rendering fails
                      return <div className="whitespace-pre-wrap">{processedContent}</div>;
                    }
                  })()}
                </React.Fragment>
              ) : (
                <div className="flex gap-1.5">
                  <div className="perplexity-pulse w-2 h-2 rounded-full bg-blue-600" />
                  <div className="perplexity-pulse w-2 h-2 rounded-full bg-blue-600 [animation-delay:0.2s]" />
                  <div className="perplexity-pulse w-2 h-2 rounded-full bg-blue-600 [animation-delay:0.4s]" />
                </div>
              )}
            </div>
          )}

          {/* Citations section */}
          {showCitations && message.citations && message.citations.length > 0 && (
            <div className="mt-6 space-y-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Icon icon="heroicons:book-open" className="w-4 h-4" />
                Sources
              </div>
              <div className="grid gap-3">
                {message.citations.map((citation, i) => (
                  <a
                    key={i}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate group p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700"
                  >
                    <div className="font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 text-xs text-blue-700 dark:text-blue-300">
                        {i + 1}
                      </span>
                      {citation.title || `Source ${i + 1}`}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate">
                      {citation.url}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}