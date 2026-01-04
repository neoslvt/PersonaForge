import { useState, useEffect } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { Character } from '../types/models'
import { storageService } from '../services/storageService'
import { generateUniqueId } from '../utils/dialogUtils'
import './CharacterEditor.css'

interface CharacterEditorProps {
  character?: Character | null
  onSave: (character: Character) => void
  onCancel: () => void
}

export default function CharacterEditor({ character, onSave, onCancel }: CharacterEditorProps) {
  const [name, setName] = useState(character?.name || '')
  const [personality, setPersonality] = useState(character?.personality || '')
  const [visualPrompt, setVisualPrompt] = useState(character?.visualPrompt || '')
  const [imagePath, setImagePath] = useState(character?.imagePath || '')

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

