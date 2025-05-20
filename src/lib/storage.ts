import "../types/chrome.d.ts"

const STORAGE_KEY = "ai_assistant_settings"

export interface Settings {
  perplexityApiKey?: string
  selectedModelId?: string
  theme?: "light" | "dark" | "system"
}

const isExtension = typeof chrome !== "undefined" && Boolean(chrome.storage)

function obfuscateApiKey(apiKey: string): string {
  if (!apiKey) return ""
  // Simple base64 encoding with a prefix to make it slightly less obvious
  return `PRP_${btoa(apiKey)}`
}

function deobfuscateApiKey(obfuscatedKey: string): string {
  if (!obfuscatedKey || !obfuscatedKey.startsWith("PRP_")) return ""
  try {
    // Remove prefix and decode
    return atob(obfuscatedKey.substring(4))
  } catch (e) {
    console.error("Error deobfuscating key", e)
    return ""
  }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await loadSettings()
  const newSettings = {
    ...current,
    ...settings,
  }

  // Always ensure API key is obfuscated when saving
  if (newSettings.perplexityApiKey) {
    // Only obfuscate if it doesn't already look obfuscated (doesn't start with PRP_)
    if (!newSettings.perplexityApiKey.startsWith("PRP_")) {
      newSettings.perplexityApiKey = obfuscateApiKey(
        newSettings.perplexityApiKey
      )
    }
  }

  try {
    if (isExtension) {
      await chrome.storage.local.set({ [STORAGE_KEY]: newSettings })
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    }
  } catch (error) {
    console.error("Error saving settings:", error)
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    let settings: Settings = { theme: "system" }

    if (isExtension && chrome?.storage?.local) {
      const data = await chrome.storage.local.get(STORAGE_KEY)
      settings = data[STORAGE_KEY] || {}
    } else {
      const storedSettings = localStorage.getItem(STORAGE_KEY)
      if (storedSettings) {
        settings = JSON.parse(storedSettings)
      }
    }

    // Deobfuscate API key if it exists
    if (settings.perplexityApiKey) {
      settings.perplexityApiKey = deobfuscateApiKey(settings.perplexityApiKey)
    }

    return settings
  } catch (error) {
    console.error("Error loading settings:", error)
    return { theme: "system" }
  }
}

export async function clearSettings(): Promise<void> {
  try {
    if (isExtension && chrome?.storage?.local) {
      await chrome.storage.local.remove(STORAGE_KEY)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch (error) {
    console.error("Error clearing settings:", error)
  }
}

export async function getInitialTheme(): Promise<"light" | "dark"> {
  try {
    const settings = await loadSettings()

    if (settings.theme === "light") return "light"
    if (settings.theme === "dark") return "dark"

    // If theme is "system" or not set, use system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  } catch (error) {
    console.error("Error getting initial theme:", error)
    return "light"
  }
}
