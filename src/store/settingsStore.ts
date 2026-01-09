import { create } from 'zustand'

export interface AISettings {
  openAIUrl: string
  openAIToken: string
  openAIModel: string
}

export interface ComfyUISettings {
  comfyUIUrl: string
  workflowJSON: string
  positivePromptNodeId: string
  samplerNodeId: string
  saveImageNodeId: string
  style: string
  backgroundWorkflowJSON: string
}

interface SettingsState {
  aiSettings: AISettings
  comfyUISettings: ComfyUISettings
  setAISettings: (settings: Partial<AISettings>) => void
  setComfyUISettings: (settings: Partial<ComfyUISettings>) => void
}

const defaultSettings: AISettings = {
  openAIUrl: 'https://api.openai.com/v1/chat/completions',
  openAIToken: '',
  openAIModel: 'gpt-3.5-turbo',
}

const defaultComfyUISettings: ComfyUISettings = {
  comfyUIUrl: 'http://127.0.0.1:8188',
  workflowJSON: '',
  positivePromptNodeId: '8',
  samplerNodeId: '10',
  saveImageNodeId: '18',
  style: '',
  backgroundWorkflowJSON: '',
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

const loadComfyUISettings = (): ComfyUISettings => {
  if (typeof window === 'undefined') return defaultComfyUISettings
  
  try {
    const saved = localStorage.getItem('personaForge_comfyUISettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...defaultComfyUISettings, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load ComfyUI settings:', error)
  }
  
  return defaultComfyUISettings
}

const saveComfyUISettings = (settings: ComfyUISettings) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('personaForge_comfyUISettings', JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save ComfyUI settings:', error)
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  aiSettings: loadSettings(),
  comfyUISettings: loadComfyUISettings(),
  
  setAISettings: (settings) => {
    const newSettings = { ...get().aiSettings, ...settings }
    set({ aiSettings: newSettings })
    saveSettings(newSettings)
  },
  
  setComfyUISettings: (settings) => {
    const newSettings = { ...get().comfyUISettings, ...settings }
    set({ comfyUISettings: newSettings })
    saveComfyUISettings(newSettings)
  },
}))
