import { useState, useEffect, useCallback } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { Character } from '../types/models'
import { storageService } from '../services/storageService'
import CharacterEditor from './CharacterEditor'
import './CharacterSelector.css'

export default function CharacterSelector() {
  const { currentCharacter, setCurrentCharacter, addCharacter, characters } = useDialogStore()
  const [isOpen, setIsOpen] = useState(false)
  const [characterList, setCharacterList] = useState<string[]>([])
  const [showEditor, setShowEditor] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null)

  useEffect(() => {
    loadCharacters()
  }, [])

  const loadCharacters = useCallback(async () => {
    try {
      const charIds = await storageService.listCharacters()
      setCharacterList(charIds)
      
      for (const charId of charIds) {
        if (!characters[charId]) {
          try {
            const char = await storageService.loadCharacter(charId)
            addCharacter(char)
          } catch (error) {
            console.error(`Failed to load character ${charId}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load characters:', error)
    }
  }, [characters, addCharacter])

  const handleCharacterSelect = useCallback(
    async (characterId: string) => {
      const char = characters[characterId] || (await storageService.loadCharacter(characterId))
      setCurrentCharacter(char)
      setIsOpen(false)
    },
    [characters, setCurrentCharacter]
  )

  const handleCreateCharacter = useCallback(() => {
    setEditingCharacter(null)
    setShowEditor(true)
    setIsOpen(false)
  }, [])

  const handleEditCharacter = useCallback((character: Character) => {
    setEditingCharacter(character)
    setShowEditor(true)
    setIsOpen(false)
  }, [])

  const handleSaveCharacter = useCallback((character: Character) => {
    addCharacter(character)
    setCurrentCharacter(character)
    setShowEditor(false)
    setEditingCharacter(null)
    loadCharacters()
  }, [addCharacter, setCurrentCharacter, loadCharacters])

  const handleCancelEditor = useCallback(() => {
    setShowEditor(false)
    setEditingCharacter(null)
  }, [])

  if (showEditor) {
    return (
      <CharacterEditor
        character={editingCharacter}
        onSave={handleSaveCharacter}
        onCancel={handleCancelEditor}
      />
    )
  }

  return (
    <>
      <div className="character-selector">
        <button
          className="character-selector-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          {currentCharacter?.name || 'Select Character'}
        </button>
        
        {isOpen && (
          <>
            <div className="character-selector-overlay" onClick={() => setIsOpen(false)} />
            <div className="character-selector-dropdown">
              <div className="character-selector-header">
                <h3>Characters</h3>
                <button onClick={handleCreateCharacter} className="character-selector-create">
                  + New
                </button>
              </div>
              
              <div className="character-selector-list">
                {characterList.length === 0 ? (
                  <div className="character-selector-empty">
                    No characters found. Create one to get started.
                  </div>
                ) : (
                  characterList.map((charId) => {
                    const char = characters[charId]
                    return (
                      <div
                        key={charId}
                        className={`character-selector-item ${
                          currentCharacter?.id === charId ? 'active' : ''
                        }`}
                      >
                        <div
                          className="character-selector-item-content"
                          onClick={() => handleCharacterSelect(charId)}
                        >
                          {char?.name || charId}
                        </div>
                        {char && (
                          <button
                            className="character-selector-edit"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCharacter(char)
                            }}
                            title="Edit character"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
