import { useState, useEffect, useCallback } from 'react'
import { useDialogStore } from '../store/dialogStore'
import { getConversationHistory } from '../utils/nodeTree'
import { DialogNode } from '../types/models'
import NodeChatPanel from './NodeChatPanel'
import './LivePreview.css'

export default function LivePreview() {
  const { currentDialog, currentCharacter, currentScene, characters, scenes, setCurrentDialog } = useDialogStore()
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<DialogNode[]>([])
  const [chatNodeId, setChatNodeId] = useState<string | null>(null)

  const displayScene = currentScene || (currentDialog?.sceneId ? scenes[currentDialog.sceneId] : null)
  
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

  const displayCharacter = currentNPCCharacter || currentCharacter

  return (
    <div className="live-preview">
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
        
        {displayCharacter?.imagePath && (
          <div className="live-preview-character">
            <img
              src={displayCharacter.imagePath}
              alt={displayCharacter.name}
              className="live-preview-character-image"
            />
            <div className="live-preview-character-name">{displayCharacter.name}</div>
          </div>
        )}
      </div>

      <div className="live-preview-history">
        <div className="live-preview-history-content">
          {conversationHistory.length === 0 ? (
            <div className="live-preview-empty">No conversation yet</div>
          ) : (
            conversationHistory.slice(0, -1).map((node) => (
              <div
                key={node.id}
                className={`live-preview-history-message live-preview-history-message-${node.speaker.toLowerCase()}`}
              >
                <div className="live-preview-history-message-speaker">
                  {node.speaker === 'NPC' 
                    ? (characters[node.characterId || '']?.name || 'NPC')
                    : 'You'}
                </div>
                <div className="live-preview-history-message-text">{node.text}</div>
              </div>
            ))
          )}
        </div>
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
  )
}

