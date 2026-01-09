import { useState, useEffect, useRef } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { useSettingsStore } from '../store/settingsStore'
import { Character, Emotion } from '../types/models'
import { storageService } from '../services/storageService'
import { generateUniqueId } from '../utils/dialogUtils'
import { ComfyUIService } from '../services/comfyUIService'
import './CharacterEditor.css'

interface CharacterEditorProps {
  character?: Character | null
  onSave: (character: Character) => void
  onCancel: () => void
}

export default function CharacterEditor({ character, onSave, onCancel }: CharacterEditorProps) {
  const { comfyUISettings } = useSettingsStore()
  const [name, setName] = useState(character?.name || '')
  const [personality, setPersonality] = useState(character?.personality || '')
  const [visualPrompt, setVisualPrompt] = useState(character?.visualPrompt || '')
  const [imagePath, setImagePath] = useState(character?.imagePath || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<{ emotion: Emotion; status: string } | null>(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    if (character) {
      setName(character.name)
      setPersonality(character.personality)
      setVisualPrompt(character.visualPrompt)
      setImagePath(character.imagePath || '')
    }
  }, [character])

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a character name')
      return
    }

    const charData: Character = {
      id: character?.id || generateUniqueId('char_'),
      name: name.trim(),
      personality: personality.trim(),
      visualPrompt: visualPrompt.trim(),
      imagePath: imagePath.trim() || undefined,
      createdAt: character?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    try {
      await storageService.saveCharacter(charData)
      onSave(charData)
    } catch (error) {
      console.error('Error saving character:', error)
      alert('Failed to save character')
    }
  }

  const handleGenerateAllAvatars = async () => {
    if (!visualPrompt.trim()) {
      alert('Please enter a visual prompt to generate avatars')
      return
    }

    if (!name.trim()) {
      alert('Please enter a character name')
      return
    }

    if (!comfyUISettings.comfyUIUrl || !comfyUISettings.workflowJSON) {
      alert('Please configure ComfyUI settings in Settings panel first')
      return
    }

    setIsGenerating(true)
    setGenerationProgress(null)
    isCancelledRef.current = false

    try {
      await ComfyUIService.generateAllEmotions(
        comfyUISettings,
        name.trim(),
        visualPrompt.trim(),
        (emotion, result) => {
          if (!isCancelledRef.current) {
            setGenerationProgress({
              emotion,
              status: result.success ? 'Success' : `Error: ${result.error || 'Unknown error'}`,
            })
          }
        },
        () => isCancelledRef.current
      )

      if (!isCancelledRef.current) {
        alert('Avatar generation completed! Check the images folder for generated avatars.')
      }
    } catch (error) {
      if (!isCancelledRef.current) {
        console.error('Avatar generation error:', error)
        alert(`Failed to generate avatars: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      setIsGenerating(false)
      setGenerationProgress(null)
      isCancelledRef.current = false
    }
  }

  const handleCancelGeneration = () => {
    isCancelledRef.current = true
    setIsGenerating(false)
    setGenerationProgress(null)
  }

  return (
    <div className="character-editor-overlay">
      <div className="character-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="character-editor-header">
          <h2>{character ? 'Edit Character' : 'New Character'}</h2>
          <button className="character-editor-close" onClick={onCancel}>×</button>
        </div>

        <div className="character-editor-content">
          <div className="character-editor-field">
            <label>Character Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              autoFocus
            />
          </div>

          <div className="character-editor-field">
            <label>Personality</label>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="Describe the character's personality, traits, speaking style..."
              rows={4}
            />
          </div>

          <div className="character-editor-field">
            <label>Visual Prompt</label>
            <textarea
              value={visualPrompt}
              onChange={(e) => setVisualPrompt(e.target.value)}
              placeholder="Description for image generation (appearance, style, etc.)"
              rows={3}
            />
          </div>

          <div className="character-editor-field">
            <label>Image Path (optional)</label>
            <input
              type="text"
              value={imagePath}
              onChange={(e) => setImagePath(e.target.value)}
              placeholder="Path to character image file"
            />
          </div>

          {visualPrompt && name && (
            <div className="character-editor-field">
              <label>Avatar Generation</label>
              <div className="character-editor-avatar-generation">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="character-editor-generate-btn"
                    onClick={handleGenerateAllAvatars}
                    disabled={isGenerating || !visualPrompt.trim() || !name.trim()}
                  >
                    {isGenerating ? 'Generating...' : 'Generate All Emotion Avatars'}
                  </button>
                  {isGenerating && (
                    <button
                      type="button"
                      className="character-editor-cancel-btn"
                      onClick={handleCancelGeneration}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {generationProgress && (
                  <div className="character-editor-generation-progress">
                    Generating: {generationProgress.emotion} - {generationProgress.status}
                  </div>
                )}
                <small>
                  Generates avatar images for all emotions using the visual prompt above.
                  Requires ComfyUI to be configured in Settings.
                </small>
              </div>
            </div>
          )}
        </div>

        <div className="character-editor-footer">
          <button onClick={onCancel} className="character-editor-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="character-editor-save">
            Save Character
          </button>
        </div>
      </div>
    </div>
  )
}

