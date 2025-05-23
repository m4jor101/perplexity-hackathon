// Ensure we only initialize once
if (!window.aiAssistantContentScriptInitialized) {
  window.aiAssistantContentScriptInitialized = true

  // Track the latest selection
  let currentSelection = ""
  let contentScriptReady = false
  let connectionAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5

  // Safely send messages to extension with error handling
  function sendMessageToExtension(message: any): void {
    try {
      if (chrome?.runtime?.id && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(message).catch((error) => {
          console.warn(
            "[ContentScript] Error sending message to extension:",
            error,
            "Message:",
            message
          )
          // If extension context is invalidated, try to reconnect
          if (error.message?.includes("Extension context invalidated")) {
            handleExtensionContextInvalidated()
          }
          // Silent failure is expected in some cases
        })
      } else {
        console.warn(
          "[ContentScript] chrome.runtime.sendMessage not available. Message not sent:",
          message
        )
      }
    } catch (error: any) {
      console.error(
        "[ContentScript] Exception in sendMessageToExtension:",
        error,
        "Message:",
        message
      )
      // Check if extension context is invalidated
      if (error.message?.includes("Extension context invalidated")) {
        handleExtensionContextInvalidated()
      }
      // Silent failure is expected
    }
  }

  // Handle extension context invalidation
  function handleExtensionContextInvalidated(): void {
    console.log(
      "[ContentScript] Extension context invalidated. Attempting to reconnect..."
    )
    contentScriptReady = false

    if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
      connectionAttempts++
      // Wait before trying to reconnect
      setTimeout(() => {
        console.log(
          `[ContentScript] Reconnection attempt ${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS}`
        )
        verifyExtensionConnection()
      }, 2000 * connectionAttempts) // Exponential backoff
    } else {
      console.error(
        "[ContentScript] Max reconnection attempts reached. Please refresh the page."
      )
    }
  }

  // Listen for text selections in the web page
  document.addEventListener("selectionchange", () => {
    try {
      const selection = window.getSelection()
      if (selection && selection.toString().trim()) {
        currentSelection = selection.toString().trim()

        // Only send message if we're initialized
        if (contentScriptReady) {
          sendMessageToExtension({
            action: "textSelected",
            text: currentSelection,
          })
        }
      }
    } catch (error) {
      console.warn("[ContentScript] Error in selectionchange listener:", error)
      // Silent failure
    }
  })


  // Handle various message types from extension
  try {
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "testContentScript") {
          sendResponse({
            success: true,
            message: "Content script is working",
            url: window.location.href,
          })
        } else if (message.action === "captureSelection") {
          const selection = window.getSelection()
          if (selection && selection.toString().trim()) {
            const text = selection.toString().trim()
            sendMessageToExtension({
              action: "textSelected",
              text: text,
              insertImmediately: true,
            })
            sendResponse({ success: true, text: text })
          } else {
            sendResponse({ success: false, message: "No text selected" })
          }
        } else if (message.action === "selectionCaptured") {
          sendResponse({ success: true })
        }

        // Always return true for async responses
        return true
      })
    } else {
      console.warn("[ContentScript] chrome.runtime.onMessage not available.")
    }
  } catch (error) {
    console.error("[ContentScript] Error setting up onMessage listener:", error)
    // Silent failure
  }

  // Check connection to background script
  function verifyExtensionConnection(): void {
    try {
      if (chrome?.runtime?.id && chrome?.runtime?.sendMessage) {
        chrome.runtime
          .sendMessage({
            action: "testConnection",
          })
          .then((response) => {
            if (response && response.success) {
              contentScriptReady = true
              connectionAttempts = 0 // Reset connection attempts on successful connection

              // Send an initialization message
              sendMessageToExtension({
                action: "contentScriptLoaded",
                url: window.location.href,
                title: document.title,
              })
            } else {
              console.warn(
                "[ContentScript] Connection test to background script failed or no success response.",
                response
              )
              // Retry with backoff
              if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
                connectionAttempts++
                setTimeout(verifyExtensionConnection, 2000 * connectionAttempts)
              }
            }
          })
          .catch((error) => {
            console.warn(
              "[ContentScript] Error sending testConnection to background script.",
              error
            )
            // Retry with backoff
            if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
              connectionAttempts++
              setTimeout(verifyExtensionConnection, 2000 * connectionAttempts)
            } else {
              console.error(
                "[ContentScript] Max reconnection attempts reached. Please refresh the page."
              )
            }
          })
      } else {
        console.warn(
          "[ContentScript] chrome.runtime.sendMessage not available for verifyExtensionConnection."
        )
        // Retry with backoff if no runtime
        if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
          connectionAttempts++
          setTimeout(verifyExtensionConnection, 2000 * connectionAttempts)
        }
      }
    } catch (error) {
      console.error(
        "[ContentScript] Exception in verifyExtensionConnection. Likely not in extension context.",
        error
      )
      // Retry with backoff if error occurs
      if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectionAttempts++
        setTimeout(verifyExtensionConnection, 2000 * connectionAttempts)
      }
    }
  }

  // Start initialization sequence
  setTimeout(() => {
    try {
      verifyExtensionConnection()
    } catch (error) {
      console.error(
        "[ContentScript] Error starting verifyExtensionConnection timeout:",
        error
      )
      // Silent failure
    }
  }, 1000)
}

// Export an empty object to make TypeScript happy
export {}
