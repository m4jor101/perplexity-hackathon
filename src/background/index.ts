// Background script entry point

// Types
interface ChromeTab {
  id?: number
  url?: string
}


type MessageCallback = (response: any) => void
type SendTarget = "extension" | number

// Helper function to safely send messages with error handling
function sendMessageSafely(
  target: SendTarget,
  message: any,
  callback?: MessageCallback
): void {
  try {
    if (target === "extension") {
      chrome.runtime
        .sendMessage(message)
        .then((response) => {
          if (callback) callback(response)
        })
        .catch((error) => {
          console.error("Error sending message to extension:", error)
        })
    } else if (typeof target === "number") {
      chrome.tabs
        .sendMessage(target, message)
        .then((response) => {
          if (callback) callback(response)
        })
        .catch((error) => {
          console.error("Error sending message to tab:", target, error)
        })
    }
  } catch (error) {
    console.error("Exception in sendMessageSafely:", error)
  }
}

// Track the last selected text
let lastSelectedText = ""

// Enhanced error logging
function logError(error: any, context: string) {
  if (error instanceof Error) {
    console.error(`${context}: ${error.name}: ${error.message}`, error.stack)
  } else if (typeof error === "object") {
    console.error(`${context}: Object error:`, JSON.stringify(error, null, 2))
  } else {
    console.error(`${context}: ${error}`)
  }
}

// Listen for messages from content scripts and extension UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Text selection handling
  if (message.action === "textSelected") {
    lastSelectedText = message.text
    sendMessageSafely("extension", {
      action: "updateSelectedText",
      text: message.text,
      insertImmediately: message.insertImmediately || false,
    })
    sendResponse({ success: true })
  }
  // Content script initialization
  else if (message.action === "contentScriptLoaded") {
    sendResponse({ acknowledged: true })
  }
  // Retrieve last selected text
  else if (message.action === "getLastSelectedText") {
    sendResponse({ text: lastSelectedText })
  }
  // Test connection
  else if (message.action === "testConnection") {
    sendResponse({
      success: true,
      message: "Background script is connected",
      lastSelectedText: lastSelectedText || "No text selected yet",
    })
  }

  // Return true to keep the message channel open for async responses
  return true
})

// Set up context menu
try {
  // First remove existing menu items to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Then create the menu item
    chrome.contextMenus.create({
      id: "sendToAI",
      title: "Send to AI Assistant",
      contexts: ["selection"],
    });
  });

  // Handle context menu selection
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "sendToAI" && info.selectionText) {
      lastSelectedText = info.selectionText;
      sendMessageSafely("extension", {
        action: "updateSelectedText",
        text: info.selectionText,
        insertImmediately: true,
      });
      if (tab?.id) {
        sendMessageSafely(tab.id, { action: "selectionCaptured" });
      }
    }
  });
} catch (error) {
  console.error("Error setting up context menu:", error);
}


// Command handling (for keyboard shortcuts)
try {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "capture_selection") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId) {
          sendMessageSafely(tabId, { action: "captureSelection" })
        }
      })
    }
  })
} catch (error) {
  console.error("Error setting up command listener:", error)
}

// Function to check if a tab can be injected with content scripts
function canInjectContentScript(url?: string): boolean {
  return Boolean(
    url &&
      (url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("file://")) &&
      !url.startsWith("https://chrome.google.com/") &&
      !url.startsWith("chrome://") &&
      !url.startsWith("chrome-extension://")
  )
}

// When extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.tabs.query({}, (tabs: ChromeTab[]) => {
      for (const tab of tabs) {
        const tabId = tab.id
        if (tabId && canInjectContentScript(tab.url)) {
          try {
            chrome.scripting
              .executeScript({
                target: { tabId },
                files: ["content.js"],
              })
              .catch((e) => {
                console.warn("Failed to execute content script on install:", e)
              })
          } catch (e) {
            console.error("Error executing script on install:", e)
          }
        }
      }
    })
  } catch (error) {
    console.error("Error in onInstalled listener:", error)
  }
})

// Listen for tab updates to inject content script into new tabs
try {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && canInjectContentScript(tab.url)) {
      chrome.scripting
        .executeScript({
          target: { tabId },
          files: ["content.js"],
        })
        .catch((e) => {
          console.warn("Failed to inject content script on update:", e)
        })
    }
  })
} catch (error) {
  console.error("Error in tabs.onUpdated listener:", error)
}

// Open the side panel when the extension icon is clicked
try {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => {
      console.warn("Failed to set side panel behavior:", error)
    })
} catch (error) {
  console.error("Error setting up side panel behavior:", error)
}
