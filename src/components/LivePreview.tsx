import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialogStore } from '../store/dialogStore'
import { getConversationHistory, getAllReachableNodes } from '../utils/nodeTree'
import { DialogNode } from '../types/models'
import NodeChatPanel from './NodeChatPanel'
import './LivePreview.css'

export default function LivePreview() {
  const { currentDialog, currentCharacter, currentScene, characters, scenes, setCurrentDialog } = useDialogStore()
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<DialogNode[]>([])
  const [chatNodeId, setChatNodeId] = useState<string | null>(null)
  const [currentBackground, setCurrentBackground] = useState<string | null>(null)
  const [currentMusic, setCurrentMusic] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(true)
  const previewRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Get current background and music from special nodes in the path
  useEffect(() => {
    if (!currentDialog || !currentNodeId) {
      setCurrentBackground(null)
      setCurrentMusic(null)
      return
    }

    const allNodes = getAllReachableNodes(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      currentNodeId
    )

    // Find the most recent setBackground and musicSet nodes
    let latestBackground: string | null = null
    let latestMusic: string | null = null
    for (const node of allNodes) {
      if (node.type === 'setBackground' && node.backgroundImage) {
        latestBackground = node.backgroundImage
      }
      if (node.type === 'musicSet' && node.musicFile) {
        latestMusic = node.musicFile
      }
    }

    setCurrentBackground(latestBackground)
    setCurrentMusic(latestMusic)
  }, [currentDialog, currentNodeId])

  // Handle music playback
  useEffect(() => {
    if (currentMusic && audioRef.current) {
      audioRef.current.src = currentMusic
      audioRef.current.loop = true
      audioRef.current.play().catch(err => {
        console.warn('Could not play music:', err)
      })
    } else if (!currentMusic && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [currentMusic])

  const displayScene = currentBackground 
    ? { backgroundImagePath: currentBackground, description: '' }
    : (currentScene || (currentDialog?.sceneId ? scenes[currentDialog.sceneId] : null))
  
  const handleFixRootNode = useCallback(() => {
    if (!currentDialog) return
    
    setCurrentDialog({ ...currentDialog }, currentDialog ? undefined : null)
  }, [currentDialog, setCurrentDialog])

  useEffect(() => {
    if (currentDialog?.rootNodeId) {
      setCurrentNodeId(currentDialog.rootNodeId)
      setConversationHistory([])
    } else {
      setCurrentNodeId(null)
      setConversationHistory([])
    }
  }, [currentDialog?.id, currentDialog?.rootNodeId])

  useEffect(() => {
    if (!currentDialog || !currentNodeId) {
      setConversationHistory([])
      return
    }

    const history = getConversationHistory(
      currentDialog.nodes,
      currentDialog.rootNodeId,
      currentNodeId
    )
    setConversationHistory(history)
  }, [currentDialog, currentNodeId])

  const currentNode = currentNodeId && currentDialog
    ? currentDialog.nodes[currentNodeId]
    : null

  const handleContinue = useCallback(() => {
    if (!currentNode || !currentDialog) return

    if (currentNode.childNodeIds.length > 0) {
      setCurrentNodeId(currentNode.childNodeIds[0])
    }
  }, [currentNode, currentDialog])

  // Calculate choices before handleScreenClick
  const availableChoices = currentNode && currentDialog
    ? currentNode.childNodeIds
        .map(id => currentDialog.nodes[id])
        .filter(node => node !== undefined)
    : []

  const playerChoices = availableChoices.filter(node => node.speaker === 'player')
  const displayChoices = currentNode?.speaker === 'NPC' && playerChoices.length > 0
    ? playerChoices
    : availableChoices

  const hasMultipleChoices = displayChoices.length > 1
  const hasSingleChoice = displayChoices.length === 1 && currentNode?.childNodeIds.length === 1
  const hasNoChoices = currentNode?.childNodeIds.length === 0

  // Handle click anywhere to advance (Ren'Py style)
  const handleScreenClick = useCallback((e: React.MouseEvent) => {
    // Don't advance if clicking on dialog box, choices, or buttons
    const target = e.target as HTMLElement
    if (target.closest('.live-preview-dialog-box') || 
        target.closest('.live-preview-dialog-choice') ||
        target.closest('button')) {
      return
    }

    // Only advance if there's a single choice or no choices
    if (currentNode && hasSingleChoice && !hasMultipleChoices) {
      handleContinue()
    }
  }, [currentNode, hasSingleChoice, hasMultipleChoices, handleContinue])

  const handleChoiceSelect = useCallback((childNodeId: string) => {
    if (!currentDialog) return
    setCurrentNodeId(childNodeId)
  }, [currentDialog])

  const handleReset = useCallback(() => {
    if (currentDialog?.rootNodeId) {
      setCurrentNodeId(currentDialog.rootNodeId)
      setConversationHistory([])
    }
  }, [currentDialog])

  const handleOpenChat = useCallback(() => {
    if (currentNodeId) {
      setChatNodeId(currentNodeId)
    }
  }, [currentNodeId])

  const handleChatNodeChange = useCallback((newNodeId: string) => {
    setChatNodeId(newNodeId)
    setCurrentNodeId(newNodeId)
  }, [])

  const currentNPCCharacter = currentNode?.speaker === 'NPC' && currentNode.characterId
    ? characters[currentNode.characterId]
    : null

  const displayCharacter = currentNPCCharacter || currentCharacter

  // Get character sprite path with emotion if available
  const getCharacterSpritePath = () => {
    if (!displayCharacter?.imagePath) return null
    
    // If NPC node has showAvatar and emotion, try to construct emotion-specific sprite path
    if (currentNode?.speaker === 'NPC' && currentNode.showAvatar && currentNode.emotion) {
      // Construct emotion-specific path (e.g., images/charactername happy.png)
      // Character images are saved as "charactername emotionname.png" with spaces
      const characterName = displayCharacter.name.toLowerCase().trim()
      const emotion = currentNode.emotion.toLowerCase().trim()
      const emotionPath = `images/${characterName} ${emotion}.png`
      
      // Return emotion-specific path (the image loader will handle fallback to base image if not found)
      return emotionPath
    }
    
    return displayCharacter.imagePath
  }

  const characterSpritePath = getCharacterSpritePath()

  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isFullscreen])

  const fullscreenContent = (
    <>
      <audio ref={audioRef} loop />
      <div 
        ref={previewRef}
        className="live-preview live-preview-fullscreen"
        onClick={handleScreenClick}
      >
      <div className="live-preview-scene">
        {displayScene?.backgroundImagePath ? (
          <img
            src={displayScene.backgroundImagePath}
            alt={displayScene.description}
            className="live-preview-background"
          />
        ) : (
          <div className="live-preview-background-placeholder">
            {displayScene?.description || (currentDialog ? 'No scene set' : '')}
          </div>
        )}
        
        {characterSpritePath && currentNode?.speaker === 'NPC' && currentNode.showAvatar && (
          <div className="live-preview-character">
            <img
              src={characterSpritePath}
              alt={displayCharacter?.name || 'Character'}
              className="live-preview-character-image"
              style={{
                opacity: currentNode.showAvatar ? 1 : 0,
                transition: 'opacity 0.3s ease'
              }}
            />
          </div>
        )}
      </div>

      
      <div className="live-preview-dialog-box">
        {!currentDialog ? (
          <div className="live-preview-dialog-empty">
            <p>No dialog loaded. Create a dialog to start previewing.</p>
          </div>
        ) : !currentNode ? (
          <div className="live-preview-dialog-empty">
            <p>Dialog loaded but has no root node. Add nodes to the dialog to start previewing.</p>
            {currentDialog.rootNodeId && (
              <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                Root node ID: {currentDialog.rootNodeId} (node not found in dialog)
              </p>
            )}
            {Object.keys(currentDialog.nodes || {}).length > 0 && (
              <button 
                className="live-preview-reset-btn" 
                onClick={handleFixRootNode}
                style={{ marginTop: '12px' }}
              >
                Auto-Fix Root Node
              </button>
            )}
          </div>
        ) : (
          <>
            {currentNode.speaker === 'NPC' ? (
              <>
                <div className="live-preview-dialog-header">
                  <span className="live-preview-dialog-name">
                    {currentNPCCharacter?.name || 'NPC'}
                  </span>
                </div>
                <div className="live-preview-dialog-text">
                  {currentNode.text || '[No text]'}
                </div>
                {hasMultipleChoices ? (
                  <div className="live-preview-dialog-choices">
                    {displayChoices.map((choiceNode) => (
                      <button
                        key={choiceNode.id}
                        className="live-preview-dialog-choice"
                        onClick={() => handleChoiceSelect(choiceNode.id)}
                      >
                        {choiceNode.text || '[No text]'}
                      </button>
                    ))}
                  </div>
                ) : hasSingleChoice ? (
                  <div className="live-preview-dialog-actions">
                    <button
                      className="live-preview-dialog-continue"
                      onClick={handleContinue}
                    >
                      Continue
                    </button>
                    <div className="live-preview-dialog-advance-hint">
                      (or click anywhere)
                    </div>
                  </div>
                ) : hasNoChoices ? (
                  <div className="live-preview-dialog-actions">
                    <div className="live-preview-dialog-end">End of conversation</div>
                  </div>
                ) : (
                  <div className="live-preview-dialog-choices">
                    {displayChoices.map((choiceNode) => (
                      <button
                        key={choiceNode.id}
                        className="live-preview-dialog-choice"
                        onClick={() => handleChoiceSelect(choiceNode.id)}
                      >
                        {choiceNode.text || '[No text]'}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="live-preview-dialog-header">
                  <span className="live-preview-dialog-name">You</span>
                </div>
                <div className="live-preview-dialog-text">
                  {currentNode.text || '[No text]'}
                </div>
                {hasMultipleChoices ? (
                  <div className="live-preview-dialog-choices">
                    {displayChoices.map((choiceNode) => (
                      <button
                        key={choiceNode.id}
                        className="live-preview-dialog-choice"
                        onClick={() => handleChoiceSelect(choiceNode.id)}
                      >
                        {choiceNode.text || '[No text]'}
                      </button>
                    ))}
                  </div>
                ) : hasSingleChoice ? (
                  <div className="live-preview-dialog-actions">
                    <button
                      className="live-preview-dialog-continue"
                      onClick={handleContinue}
                    >
                      Continue
                    </button>
                    <div className="live-preview-dialog-advance-hint">
                      (or click anywhere)
                    </div>
                  </div>
                ) : hasNoChoices ? (
                  <div className="live-preview-dialog-actions">
                    <div className="live-preview-dialog-end">End of conversation</div>
                  </div>
                ) : (
                  <div className="live-preview-dialog-choices">
                    {displayChoices.map((choiceNode) => (
                      <button
                        key={choiceNode.id}
                        className="live-preview-dialog-choice"
                        onClick={() => handleChoiceSelect(choiceNode.id)}
                      >
                        {choiceNode.text || '[No text]'}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="live-preview-dialog-controls">
              <button 
                className="live-preview-exit-fullscreen"
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen (ESC)"
              >
                ✕
              </button>
              <button 
                className="live-preview-chat-btn" 
                onClick={handleOpenChat}
                title="Open chat to continue conversation"
              >
                Chat
              </button>
              <button className="live-preview-reset-btn" onClick={handleReset}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>
      {chatNodeId && (
        <NodeChatPanel
          nodeId={chatNodeId}
          onClose={() => {
            setChatNodeId(null)
          }}
          onNodeChange={handleChatNodeChange}
        />
      )}
    </div>
    </>
  )

  if (!isFullscreen) {
    return (
      <div className="live-preview-container">
        <button 
          className="live-preview-enter-fullscreen"
          onClick={() => setIsFullscreen(true)}
        >
          Enter Fullscreen Preview
        </button>
      </div>
    )
  }

  // Render fullscreen preview as a portal to document.body to break out of app layout
  return createPortal(fullscreenContent, document.body)
}

