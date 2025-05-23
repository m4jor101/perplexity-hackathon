/**
 * API module for interacting with Perplexity Sonar API
 */

// Message types
export interface Message {
  role: "user" | "assistant" | "system"
  content: string
  citations?: Citation[]
  reasoning?: string
}

export interface Citation {
  title: string
  url: string
  snippet: string
}

const API_ENDPOINT = "https://api.perplexity.ai/chat/completions"

interface APIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Process query through Perplexity Sonar API
 */
const DEFAULT_SYSTEM_MESSAGE = "You are a AI friend called Perplexity.";

export async function processAIResponse(
  prompt: string,
  messages: Message[],
  modelId: string,
  apiKey: string,
  onProgress?: (text: string) => void,
  onError?: (error: any) => void
): Promise<{ text: string; citations?: Citation[] }> {
  try {
    // Add system message if not present
    const messagesWithSystem = messages.some(msg => msg.role === 'system') 
      ? messages 
      : [{ role: 'system', content: DEFAULT_SYSTEM_MESSAGE }, ...messages];
    
    // Format messages according to Perplexity API requirements
    const apiMessages: APIMessage[] = formatMessagesForAPI(messagesWithSystem, prompt)

    // Sanitize messages to ensure JSON safety
    const sanitizedMessages = apiMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // Create request body with safe values
    const requestBody = {
      model: modelId,
      messages: sanitizedMessages,
      stream: Boolean(onProgress),
    }

    // Check for valid JSON before sending
    try {
      // Validate JSON stringification
      const jsonBody = JSON.stringify(requestBody)
      // Parse it back to ensure it's valid
      JSON.parse(jsonBody)
    } catch (jsonError: unknown) {
      console.error("Invalid JSON construction:", jsonError)
      if (jsonError instanceof Error) {
        throw new Error(
          "Failed to construct valid API request: " + jsonError.message
        )
      } else {
        throw new Error("Failed to construct valid API request")
      }
    }

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || "API request failed")
    }

    // For streaming responses, we need to handle differently than non-streaming
    if (onProgress && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let responseText = ""
      let lastData = null
      let citations: Citation[] = []
      let buffer = "" // Buffer for accumulating partial chunks

      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // Process complete messages from buffer
          const lines = buffer.split("\n")
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith("data: ")) continue

            try {
              const jsonStr = trimmedLine.slice(6)
              // Skip empty JSON or "[DONE]" messages
              if (jsonStr === "[DONE]" || !jsonStr.trim()) continue

              const data = JSON.parse(jsonStr)
              lastData = data

              // Extract content from delta if available
              if (data.choices?.[0]?.delta?.content) {
                responseText += data.choices[0].delta.content
                onProgress(responseText)
              }

              // Extract content from complete message if available
              if (
                data.choices?.[0]?.message?.content &&
                !data.choices?.[0]?.delta
              ) {
                responseText = data.choices[0].message.content
                onProgress(responseText)
              }

              // Check if this is the last message
              if (data.choices?.[0]?.finish_reason === "stop") {
                // Extract citations properly
                if (data.citations && Array.isArray(data.citations)) {
                  citations = data.citations.map(
                    (citation: any, index: number) => ({
                      title: citation.title || `Citation ${index + 1}`,
                      url: citation.url || citation,
                      snippet: citation.snippet || `Source ${index + 1}`,
                    })
                  )
                }
              }
            } catch (parseError) {
              console.error(
                "Error parsing streaming response:",
                parseError,
                trimmedLine.slice(6)
              )
              // Continue processing other lines even if one fails
            }
          }
        }

        // Process any remaining data in the buffer
        if (buffer.trim()) {
          const lines = buffer.split("\n")
          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith("data: ")) continue

            try {
              const jsonStr = trimmedLine.slice(6)
              if (jsonStr === "[DONE]" || !jsonStr.trim()) continue

              const data = JSON.parse(jsonStr)

              if (data.choices?.[0]?.delta?.content) {
                responseText += data.choices[0].delta.content
                onProgress(responseText)
              }

              if (
                data.choices?.[0]?.message?.content &&
                !data.choices?.[0]?.delta
              ) {
                responseText = data.choices[0].message.content
                onProgress(responseText)
              }

              // Handle final citations
              if (
                data.choices?.[0]?.finish_reason === "stop" &&
                data.citations &&
                Array.isArray(data.citations)
              ) {
                citations = data.citations.map(
                  (citation: any, index: number) => ({
                    title: citation.title || `Citation ${index + 1}`,
                    url: citation.url || citation,
                    snippet: citation.snippet || `Source ${index + 1}`,
                  })
                )
              }
            } catch (parseError) {
              // Ignore errors in the final buffer processing
            }
          }
        }
      }

      // Use the accumulated data instead of trying to read the body again
      return {
        text: responseText,
        citations: citations.length > 0 ? citations : undefined,
      }
    } else {
      // For non-streaming responses, we can use response.json() as before
      const data = await response.json()

      // Ensure the response has the expected format
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Unexpected response format from API")
      }

      let responseText = data.choices[0].message.content || ""

      // Extract citations if available
      let citations: Citation[] = []
      if (data.citations && Array.isArray(data.citations)) {
        citations = data.citations.map((citation: any, index: number) => ({
          title: citation.title || `Citation ${index + 1}`,
          url: citation.url || citation,
          snippet: citation.snippet || `Source ${index + 1}`,
        }))
      }

      return {
        text: responseText,
        citations: citations.length > 0 ? citations : undefined,
      }
    }
  } catch (error) {
    console.error("API Error:", error)
    if (onError) onError(error)
    throw error
  }
}

/**
 * Format messages according to Perplexity API requirements:
 * 1. System messages (if any) must be at the beginning
 * 2. After system messages, strictly alternate between user and assistant
 */
function formatMessagesForAPI(
  messages: Message[],
  currentPrompt: string
): APIMessage[] {
  // Step 1: Extract system messages (they must come first)
  const systemMessages: APIMessage[] = messages
    .filter((msg) => msg.role === "system")
    .map((msg) => ({ role: "system", content: msg.content }))

  // Step 2: Extract non-system messages
  const conversationMessages: Message[] = messages.filter(
    (msg) => msg.role !== "system"
  )

  // Step 3: Create a properly alternating sequence
  const formattedConversation: APIMessage[] = []

  // If we have conversation messages, process them
  if (conversationMessages.length > 0) {

    // Process remaining messages ensuring alternation
    for (let i = 1; i < conversationMessages.length; i++) {
      const prevRole = conversationMessages[i - 1].role
      const currentRole = conversationMessages[i].role

      // If roles are the same, insert a placeholder message to maintain alternation
      if (prevRole === currentRole) {
        formattedConversation.push({
          role: prevRole === "user" ? "assistant" : "user",
          content: prevRole === "user" ? "I understand." : "Continue please.",
        })
      }

      // Add the current message
      formattedConversation.push({
        role: currentRole,
        content: conversationMessages[i].content,
      })
    }
  }

  // Step 4: Handle the current prompt
  if (formattedConversation.length === 0) {
    // If no conversation yet, just add the prompt as a user message
    formattedConversation.push({
      role: "user",
      content: currentPrompt,
    })
  } else {
    // Check the last message role
    const lastRole =
      formattedConversation[formattedConversation.length - 1].role

    // If last message was from assistant, we can add the prompt directly
    if (lastRole === "assistant") {
      formattedConversation.push({
        role: "user",
        content: currentPrompt,
      })
    } else {
      // If last message was from user, add an assistant message first
      formattedConversation.push({
        role: "assistant",
        content: "I understand.",
      })
      formattedConversation.push({
        role: "user",
        content: currentPrompt,
      })
    }
  }

  // Combine system messages and conversation messages
  return [...systemMessages, ...formattedConversation]
}
