import { useState, useCallback } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import './SettingsPanel.css'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { aiSettings, setAISettings, comfyUISettings, setComfyUISettings } = useSettingsStore()
  const [openAIUrl, setOpenAIUrl] = useState(aiSettings.openAIUrl)
  const [openAIToken, setOpenAIToken] = useState(aiSettings.openAIToken)
  const [openAIModel, setOpenAIModel] = useState(aiSettings.openAIModel)
  const [comfyUIUrl, setComfyUIUrl] = useState(comfyUISettings.comfyUIUrl)
  const [workflowJSON, setWorkflowJSON] = useState(comfyUISettings.workflowJSON)
  const [positivePromptNodeId, setPositivePromptNodeId] = useState(comfyUISettings.positivePromptNodeId)
  const [samplerNodeId, setSamplerNodeId] = useState(comfyUISettings.samplerNodeId)
  const [saveImageNodeId, setSaveImageNodeId] = useState(comfyUISettings.saveImageNodeId)
  const [style, setStyle] = useState(comfyUISettings.style)
  const [backgroundWorkflowJSON, setBackgroundWorkflowJSON] = useState(comfyUISettings.backgroundWorkflowJSON)

  const handleSave = useCallback(() => {
    setAISettings({
      openAIUrl: openAIUrl.trim(),
      openAIToken: openAIToken.trim(),
      openAIModel: openAIModel.trim(),
    })
    setComfyUISettings({
      comfyUIUrl: comfyUIUrl.trim(),
      workflowJSON: workflowJSON.trim(),
      positivePromptNodeId: positivePromptNodeId.trim(),
      samplerNodeId: samplerNodeId.trim(),
      saveImageNodeId: saveImageNodeId.trim(),
      style: style.trim(),
      backgroundWorkflowJSON: backgroundWorkflowJSON.trim(),
    })
    onClose()
  }, [
    openAIUrl, openAIToken, openAIModel, setAISettings,
    comfyUIUrl, workflowJSON, positivePromptNodeId, samplerNodeId, saveImageNodeId, style, backgroundWorkflowJSON, setComfyUISettings,
    onClose
  ])

  const handleCancel = useCallback(() => {
    setOpenAIUrl(aiSettings.openAIUrl)
    setOpenAIToken(aiSettings.openAIToken)
    setOpenAIModel(aiSettings.openAIModel)
    setComfyUIUrl(comfyUISettings.comfyUIUrl)
    setWorkflowJSON(comfyUISettings.workflowJSON)
    setPositivePromptNodeId(comfyUISettings.positivePromptNodeId)
    setSamplerNodeId(comfyUISettings.samplerNodeId)
    setSaveImageNodeId(comfyUISettings.saveImageNodeId)
    setStyle(comfyUISettings.style)
    setBackgroundWorkflowJSON(comfyUISettings.backgroundWorkflowJSON)
    onClose()
  }, [aiSettings, comfyUISettings, onClose])

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

        <div className="settings-section">
          <h3>ComfyUI Configuration (Avatar Generation)</h3>
          
          <div className="settings-form-group">
            <label htmlFor="comfyui-url">ComfyUI URL:</label>
            <input
              id="comfyui-url"
              type="text"
              value={comfyUIUrl}
              onChange={(e) => setComfyUIUrl(e.target.value)}
              placeholder="http://127.0.0.1:8188"
            />
            <small>Default: http://127.0.0.1:8188</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="workflow-json">Workflow JSON:</label>
            <textarea
              id="workflow-json"
              value={workflowJSON}
              onChange={(e) => setWorkflowJSON(e.target.value)}
              placeholder="Paste your ComfyUI workflow JSON here"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <small>Your ComfyUI workflow JSON. Export from ComfyUI and paste here.</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="positive-prompt-node">Positive Prompt Node ID:</label>
            <input
              id="positive-prompt-node"
              type="text"
              value={positivePromptNodeId}
              onChange={(e) => setPositivePromptNodeId(e.target.value)}
              placeholder="8"
            />
            <small>Node ID for the CLIPTextEncode (Positive Prompt) node</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="sampler-node">Sampler Node ID:</label>
            <input
              id="sampler-node"
              type="text"
              value={samplerNodeId}
              onChange={(e) => setSamplerNodeId(e.target.value)}
              placeholder="10"
            />
            <small>Node ID for the KSampler node</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="save-image-node">Save Image Node ID:</label>
            <input
              id="save-image-node"
              type="text"
              value={saveImageNodeId}
              onChange={(e) => setSaveImageNodeId(e.target.value)}
              placeholder="18"
            />
            <small>Node ID for the SaveImage node</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="image-style">Image Style (for Qwen3):</label>
            <textarea
              id="image-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="e.g., anime style, realistic, oil painting, digital art, etc."
              rows={3}
            />
            <small>Style description for image generation. This will be added to all prompts. Qwen3 understands natural language descriptions well.</small>
          </div>
          
          <div className="settings-form-group">
            <label htmlFor="background-workflow-json">Background Workflow JSON:</label>
            <textarea
              id="background-workflow-json"
              value={backgroundWorkflowJSON}
              onChange={(e) => setBackgroundWorkflowJSON(e.target.value)}
              placeholder="Paste your ComfyUI workflow JSON for background generation here"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <small>Your ComfyUI workflow JSON specifically for background generation. Export from ComfyUI and paste here. Uses the same node IDs as avatar generation.</small>
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

