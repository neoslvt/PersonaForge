import { create } from 'zustand'

export interface AISettings {
  openAIUrl: string
  openAIToken: string
  openAIModel: string
}

interface SettingsState {
  aiSettings: AISettings
  
  setAISettings: (settings: Partial<AISettings>) => void
}

const defaultSettings: AISettings = {
  openAIUrl: 'https://api.openai.com/v1/chat/completions',
  openAIToken: '',
  openAIModel: 'gpt-3.5-turbo',
}

const loadSettings = (): AISettings => {
  if (typeof window === 'undefined') return defaultSettings
  
  try {
    const saved = localStorage.getItem('personaForge_aiSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultSettings, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
  
  return defaultSettings
}

const saveSettings = (settings: AISettings) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('personaForge_aiSettings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  aiSettings: loadSettings(),
  
  setAISettings: (settings) => {
    const newSettings = { ...get().aiSettings, ...settings }
    set({ aiSettings: newSettings })
    saveSettings(newSettings)
  },
}))
