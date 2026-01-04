import { useState, useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import './SettingsPanel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { aiSettings, setAISettings } = useSettingsStore()
  const [openAIUrl, setOpenAIUrl] = useState(aiSettings.openAIUrl)
  const [openAIToken, setOpenAIToken] = useState(aiSettings.openAIToken)
  const [openAIModel, setOpenAIModel] = useState(aiSettings.openAIModel)

  const handleSave = useCallback(() => {
    setAISettings({
      openAIUrl: openAIUrl.trim(),
      openAIToken: openAIToken.trim(),
      openAIModel: openAIModel.trim(),
    })
    onClose()
  }, [openAIUrl, openAIToken, openAIModel, setAISettings, onClose])

  const handleCancel = useCallback(() => {
    setOpenAIUrl(aiSettings.openAIUrl)
    setOpenAIToken(aiSettings.openAIToken)
    setOpenAIModel(aiSettings.openAIModel)
    onClose()
  }, [aiSettings, onClose])

  return (
    <div className="settings-panel-overlay">
      <div className="settings-panel-modal">
        <h2>Settings</h2>
        
        <div className="settings-section">
          <h3>OpenAI Configuration</h3>
          
          <div className="settings-form-group">
            <label htmlFor="openai-url">OpenAI API URL:</label>
            <input
              id="openai-url"
              type="text"
              value={openAIUrl}
              onChange={(e) => setOpenAIUrl(e.target.value)}
              placeholder="https://api.openai.com/v1/chat/completions"
            />
            <small>Default: https://api.openai.com/v1/chat/completions</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="openai-token">OpenAI API Token:</label>
            <input
              id="openai-token"
              type="password"
              value={openAIToken}
              onChange={(e) => setOpenAIToken(e.target.value)}
              placeholder="sk-..."
            />
            <small>Your OpenAI API key (stored locally)</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="openai-model">OpenAI Model:</label>
            <input
              id="openai-model"
              type="text"
              value={openAIModel}
              onChange={(e) => setOpenAIModel(e.target.value)}
              placeholder="gpt-3.5-turbo"
            />
            <small>Model name (e.g., gpt-3.5-turbo, gpt-4, gpt-4-turbo)</small>
          </div>
        </div>

        <div className="settings-panel-actions">
          <button onClick={handleCancel} className="settings-button-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="settings-button-save">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

