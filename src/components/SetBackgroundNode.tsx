import { useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { DialogNode } from '../types/models'
import { useDialogStore } from '../store/dialogStore'
import { useSettingsStore } from '../store/settingsStore'
import { ComfyUIService } from '../services/comfyUIService'
import './DialogNodeComponent.css'

interface SetBackgroundNodeData {
  node: DialogNode
}

export default function SetBackgroundNode({ data, id }: NodeProps<SetBackgroundNodeData>) {
  const { node } = data
  const { updateNode, deleteNode } = useDialogStore()
  const { comfyUISettings } = useSettingsStore()
  const [backgroundImage, setBackgroundImage] = useState(node.backgroundImage || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [imageExists, setImageExists] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    setBackgroundImage(node.backgroundImage || '')
    checkImageExists(node.backgroundImage || '')
  }, [node.backgroundImage])

  const checkImageExists = useCallback(async (imagePath: string) => {
    if (!imagePath) {
      setImageExists(false)
      setImagePreview(null)
      return
    }

    // Keep "bg " prefix for file lookup, use spaces (no underscores)
    // The filename should be like "bg school classroom.png"
    const filename = imagePath.toLowerCase().trim() + (imagePath.toLowerCase().trim().endsWith('.png') ? '' : '.png')
    const fullPath = `images/${filename}`

    // Try Electron API first
    if (window.electronAPI) {
      try {
        const exists = await window.electronAPI.exists(fullPath)
        setImageExists(exists)
        if (exists) {
          // Try to load the image for preview
          try {
            // Read the file as binary (base64) and convert to data URL for preview
            if (window.electronAPI.readFileBinary) {
              const base64Data = await window.electronAPI.readFileBinary(fullPath)
              setImagePreview(`data:image/png;base64,${base64Data}`)
            } else {
              // Fallback: try reading as text (might work if file was saved as base64)
              try {
                const fileData = await window.electronAPI.readFile(fullPath)
                if (fileData.startsWith('data:')) {
                  setImagePreview(fileData)
                } else {
                  setImagePreview(`data:image/png;base64,${fileData}`)
                }
              } catch {
                setImagePreview(null)
              }
            }
          } catch (error) {
            console.error('Error loading image preview:', error)
            setImagePreview(null)
          }
        } else {
          setImagePreview(null)
        }
      } catch (error) {
        console.error('Error checking image existence:', error)
        setImageExists(false)
        setImagePreview(null)
      }
    } else {
      // Use HTTP API for browser dev mode
      try {
        const response = await fetch(`/api/check-image?filename=${encodeURIComponent(filename)}`)
        if (response.ok) {
          const result = await response.json()
          setImageExists(result.exists)
          
          if (result.exists) {
            // Load image for preview
            try {
              const readResponse = await fetch(`/api/read-image?filename=${encodeURIComponent(filename)}`)
              if (readResponse.ok) {
                const readResult = await readResponse.json()
                setImagePreview(readResult.data)
              } else {
                setImagePreview(null)
              }
            } catch (error) {
              console.error('Error loading image preview:', error)
              setImagePreview(null)
            }
          } else {
            setImagePreview(null)
          }
        } else {
          setImageExists(false)
          setImagePreview(null)
        }
      } catch (error) {
        console.error('Error checking image existence:', error)
        setImageExists(false)
        setImagePreview(null)
      }
    }
  }, [])

  const handleBackgroundChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBackgroundImage(e.target.value)
    },
    []
  )

  const handleBackgroundBlur = useCallback(() => {
    updateNode(id, { backgroundImage: backgroundImage || undefined })
  }, [id, backgroundImage, updateNode])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      deleteNode(id)
    }
  }, [deleteNode, id])

  const handleGenerate = useCallback(async () => {
    if (!backgroundImage.trim()) {
      alert('Please enter a background name/prompt first')
      return
    }

    if (!comfyUISettings.comfyUIUrl || !comfyUISettings.backgroundWorkflowJSON) {
      alert('Please configure ComfyUI settings and background workflow JSON in Settings panel first')
      return
    }

    setIsGenerating(true)
    isCancelledRef.current = false

    try {
      // Remove "bg " prefix if present
      const cleanPrompt = backgroundImage.replace(/^bg\s+/i, '').trim()
      
      const result = await ComfyUIService.generateBackground(
        comfyUISettings,
        {
          prompt: cleanPrompt,
          width: 1280,
          height: 720,
        },
        () => isCancelledRef.current
      )

      if (!isCancelledRef.current) {
        if (result.success && result.imagePath) {
          // Don't change the input field - keep the original value (e.g., "bg school classroom")
          // Just refresh the image check to see if the generated image exists
          // The image was saved as "school classroom.png" based on the clean prompt
          await checkImageExists(backgroundImage)
        } else {
          alert(`Failed to generate background: ${result.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      if (!isCancelledRef.current) {
        console.error('Background generation error:', error)
        alert(`Failed to generate background: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } finally {
      setIsGenerating(false)
      isCancelledRef.current = false
    }
  }, [backgroundImage, comfyUISettings, id, updateNode, checkImageExists])

  const handleCancelGeneration = useCallback(() => {
    isCancelledRef.current = true
    setIsGenerating(false)
  }, [])

  return (
    <div className="dialog-node dialog-node-background">
      <Handle type="target" position={Position.Top} />
      
      <div className="dialog-node-header">
        <span className="dialog-node-type">Set Background</span>
        <button 
          onClick={handleDelete} 
          className="dialog-node-delete" 
          title="Delete node"
        >
          ×
        </button>
      </div>
      
      <div className="dialog-node-content">
        <div className="dialog-node-field">
          <label>Background Image:</label>
          <input
            type="text"
            value={backgroundImage}
            onChange={handleBackgroundChange}
            onBlur={handleBackgroundBlur}
            placeholder="bg room"
            className="dialog-node-input"
          />
        </div>

        {backgroundImage && (
          <div className="dialog-node-field">
            <div className="set-background-preview">
              {imagePreview ? (
                <div className="set-background-image-preview">
                  <img 
                    src={imagePreview}
                    alt="Background preview"
                    onError={() => {
                      setImagePreview(null)
                      setImageExists(false)
                    }}
                    style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }}
                  />
                  <div className="set-background-status exists">Image exists</div>
                </div>
              ) : (
                <div className="set-background-status missing">
                  Image not found: {backgroundImage.replace(/^bg\s+/i, '').trim()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dialog-node-field">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="set-background-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !backgroundImage.trim()}
              title={!backgroundImage.trim() ? 'Enter a background name first' : 'Generate background image with ComfyUI'}
            >
              {isGenerating ? 'Generating...' : 'Generate Background'}
            </button>
            {isGenerating && (
              <button
                type="button"
                onClick={handleCancelGeneration}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                title="Cancel generation"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

