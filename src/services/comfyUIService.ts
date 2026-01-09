import { ComfyUISettings } from '../store/settingsStore'
import { Emotion } from '../types/models'

// Ensure window.electronAPI is available
declare global {
  interface Window {
    electronAPI?: {
      readFile: (path: string) => Promise<string>
      readFileBinary: (path: string) => Promise<string>
      writeFile: (path: string, data: string) => Promise<void>
      writeFileBinary: (path: string, data: Uint8Array) => Promise<void>
      readDir: (path: string) => Promise<string[]>
      mkdir: (path: string) => Promise<void>
      exists: (path: string) => Promise<boolean>
      joinPath: (...paths: string[]) => string
      getUserDataPath: () => Promise<string>
      showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>
      showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>
    }
  }
}

export interface AvatarGenerationOptions {
  characterName: string
  visualPrompt: string
  emotion: Emotion
}

export interface AvatarGenerationResult {
  success: boolean
  imagePath?: string
  error?: string
}

export interface BackgroundGenerationOptions {
  prompt: string
  width?: number
  height?: number
}

export interface BackgroundGenerationResult {
  success: boolean
  imagePath?: string
  error?: string
}

/**
 * Service for generating character avatars using ComfyUI
 */
export class ComfyUIService {
  /**
   * Generate an avatar image for a character with a specific emotion
   */
  static async generateAvatar(
    settings: ComfyUISettings,
    options: AvatarGenerationOptions,
    isCancelled?: () => boolean
  ): Promise<AvatarGenerationResult> {
    try {
      // Validate settings
      if (!settings.comfyUIUrl) {
        return { success: false, error: 'ComfyUI URL is not configured' }
      }

      if (!settings.workflowJSON) {
        return { success: false, error: 'Workflow JSON is not configured' }
      }

      // Parse workflow JSON
      let workflow: any
      try {
        workflow = JSON.parse(settings.workflowJSON)
      } catch (error) {
        return { success: false, error: 'Invalid workflow JSON format' }
      }

      // Build the prompt with visual description and emotion
      const emotionDescriptions: Record<Emotion, string> = {
        'excited': 'excited, energetic, enthusiastic expression',
        'horny': 'seductive, alluring, flirtatious expression',
        'flirt': 'flirtatious, playful, charming expression',
        'very happy': 'very happy, joyful, ecstatic expression',
        'happy cry': 'crying with joy, tears of happiness, emotional happiness',
        'shy': 'shy, bashful, timid expression',
        'happy': 'happy, cheerful, smiling expression',
        'neutral': 'neutral, calm, expressionless',
        'questioning': 'questioning, curious, puzzled expression',
        'thinking': 'thinking, contemplative, thoughtful expression',
        'surprised': 'surprised, shocked, wide-eyed expression',
        'confused': 'confused, bewildered, uncertain expression',
        'disappointed': 'disappointed, sad, let down expression',
        'angry': 'angry, furious, enraged expression',
        'little sad': 'slightly sad, melancholic, downcast expression',
        'sad': 'sad, sorrowful, depressed expression',
        'cry': 'crying, tears, emotional distress expression',
      }

      const emotionDesc = emotionDescriptions[options.emotion] || options.emotion
      
      // Build prompt: combine visual prompt, emotion, style, and quality tags
      // Qwen3 understands natural language well, so we can be descriptive
      const promptParts: string[] = []
      
      // Add visual prompt (character appearance)
      if (options.visualPrompt.trim()) {
        promptParts.push(options.visualPrompt.trim())
      }
      
      // Add emotion description
      promptParts.push(emotionDesc)
      
      // Add style if configured
      if (settings.style && settings.style.trim()) {
        promptParts.push(settings.style.trim())
      }
      
      // Add quality and format tags
      promptParts.push('character portrait', 'high quality', 'detailed')
      
      // Combine all parts with commas (Qwen3 handles this well)
      const fullPrompt = promptParts.join(', ')

      // Modify workflow nodes
      if (workflow[settings.positivePromptNodeId]) {
        workflow[settings.positivePromptNodeId].inputs.text = fullPrompt
      } else {
        return { success: false, error: `Positive prompt node ${settings.positivePromptNodeId} not found in workflow` }
      }

      // Randomize seed
      if (workflow[settings.samplerNodeId]) {
        const newSeed = Math.floor(Math.random() * 1125899906842624)
        workflow[settings.samplerNodeId].inputs.seed = newSeed
      }

      // Submit to ComfyUI
      const response = await fetch(`${settings.comfyUIUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: workflow }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `ComfyUI API error: ${errorText}` }
      }

      const result = await response.json()
      const promptId = result.prompt_id

      if (!promptId) {
        return { success: false, error: 'Failed to get prompt ID from ComfyUI' }
      }

      // Poll for completion
      let completed = false
      let attempts = 0
      const maxAttempts = 60 // 3 minutes max (60 * 3 seconds)

      while (!completed && attempts < maxAttempts) {
        // Check for cancellation
        if (isCancelled && isCancelled()) {
          return { success: false, error: 'Generation cancelled' }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds

        const historyResponse = await fetch(`${settings.comfyUIUrl}/history/${promptId}`)
        if (!historyResponse.ok) {
          attempts++
          continue
        }

        const history = await historyResponse.json()

        if (history[promptId]) {
          completed = true
          const outputs = history[promptId].outputs

          if (outputs[settings.saveImageNodeId]?.images?.[0]) {
            const imageData = outputs[settings.saveImageNodeId].images[0]
            const comfyFilename = imageData.filename

            // Download the image
            const imageUrl = `${settings.comfyUIUrl}/view?filename=${comfyFilename}&type=output`
            const imageResponse = await fetch(imageUrl)

            if (!imageResponse.ok) {
              return { success: false, error: 'Failed to download generated image' }
            }

            const imageBlob = await imageResponse.blob()

            // Save to images directory
            // Use spaces, no underscores, lowercase
            const sanitizedName = options.characterName.toLowerCase().trim()
            const sanitizedEmotion = options.emotion.toLowerCase().trim()
            const filename = `${sanitizedName} ${sanitizedEmotion}.png`
            const imagePath = `images/${filename}`

            // Convert blob to base64 for API call
            const arrayBuffer = await imageBlob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            // Try Electron API first (if running in Electron)
            if (typeof window !== 'undefined' && window.electronAPI) {
              try {
                // Ensure images directory exists
                const imagesDir = window.electronAPI.joinPath('images')
                const exists = await window.electronAPI.exists(imagesDir)
                if (!exists) {
                  await window.electronAPI.mkdir(imagesDir)
                }
                
                // Save image using writeFileBinary
                const fullPath = window.electronAPI.joinPath(imagesDir, filename)
                
                if (window.electronAPI.writeFileBinary) {
                  await window.electronAPI.writeFileBinary(fullPath, uint8Array)
                } else {
                  // Fallback: convert to base64
                  let binary = ''
                  for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i])
                  }
                  const base64 = btoa(binary)
                  await window.electronAPI.writeFile(fullPath, base64)
                }
                
                return { success: true, imagePath }
              } catch (error) {
                console.error('Error saving image with Electron API:', error)
                // Fall through to HTTP API
              }
            }
            
            // Use HTTP API to save via Node.js server (for browser dev mode)
            try {
              // Convert to base64
              let binary = ''
              for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i])
              }
              const base64 = btoa(binary)
              const base64DataUrl = `data:image/png;base64,${base64}`
              
              const response = await fetch('/api/save-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  filename,
                  data: base64DataUrl,
                }),
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to save image')
              }
              
              const result = await response.json()
              return { success: true, imagePath: result.path || imagePath }
            } catch (error) {
              console.error('Error saving image via API:', error)
              // Last resort: browser download
              const url = URL.createObjectURL(imageBlob)
              const a = document.createElement('a')
              a.href = url
              a.download = filename
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              
              return { success: true, imagePath: url }
            }
          } else {
            return { success: false, error: `Save image node ${settings.saveImageNodeId} not found in workflow output` }
          }
        }

        attempts++
      }

      return { success: false, error: 'Generation timed out after 3 minutes' }
    } catch (error) {
      console.error('Avatar generation error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }

  /**
   * Generate all emotion variants for a character
   */
  static async generateAllEmotions(
    settings: ComfyUISettings,
    characterName: string,
    visualPrompt: string,
    onProgress?: (emotion: Emotion, result: AvatarGenerationResult) => void,
    isCancelled?: () => boolean
  ): Promise<Record<Emotion, AvatarGenerationResult>> {
    const emotions: Emotion[] = [
      'excited', 'horny', 'flirt', 'very happy', 'happy cry', 'shy', 'happy', 
      'neutral', 'questioning', 'thinking', 'surprised', 'confused', 
      'disappointed', 'angry', 'little sad', 'sad', 'cry'
    ]

    const results: Record<Emotion, AvatarGenerationResult> = {} as any

    for (const emotion of emotions) {
      // Check for cancellation before each emotion
      if (isCancelled && isCancelled()) {
        break
      }
      
      const result = await this.generateAvatar(settings, {
        characterName,
        visualPrompt,
        emotion,
      }, isCancelled)

      results[emotion] = result

      if (onProgress) {
        onProgress(emotion, result)
      }

      // Check for cancellation after each emotion
      if (isCancelled && isCancelled()) {
        break
      }

      // Small delay between generations to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return results
  }

  /**
   * Generate a background image using ComfyUI
   */
  static async generateBackground(
    settings: ComfyUISettings,
    options: BackgroundGenerationOptions,
    isCancelled?: () => boolean
  ): Promise<BackgroundGenerationResult> {
    try {
      // Validate settings
      if (!settings.comfyUIUrl) {
        return { success: false, error: 'ComfyUI URL is not configured' }
      }

      if (!settings.backgroundWorkflowJSON) {
        return { success: false, error: 'Background workflow JSON is not configured' }
      }

      // Parse workflow JSON
      let workflow: any
      try {
        workflow = JSON.parse(settings.backgroundWorkflowJSON)
      } catch (error) {
        return { success: false, error: 'Invalid background workflow JSON format' }
      }

      // Set dimensions (default 1280x720 for backgrounds)
      const width = options.width || 1280
      const height = options.height || 720

      // Find and update EmptySD3LatentImage or similar node that has width/height inputs
      let latentImageNodeId: string | null = null
      for (const [nodeId, nodeData] of Object.entries(workflow)) {
        if (nodeData.class_type === 'EmptySD3LatentImage' || 
            (nodeData.inputs && 'width' in nodeData.inputs && 'height' in nodeData.inputs)) {
          latentImageNodeId = nodeId
          break
        }
      }

      if (latentImageNodeId && workflow[latentImageNodeId]) {
        workflow[latentImageNodeId].inputs.width = width
        workflow[latentImageNodeId].inputs.height = height
      }

      // Build the prompt with style
      const promptParts: string[] = []
      
      // Add the background prompt
      if (options.prompt.trim()) {
        promptParts.push(options.prompt.trim())
      }
      
      // Add style if configured
      if (settings.style && settings.style.trim()) {
        promptParts.push(settings.style.trim())
      }
      
      // Add quality tags for backgrounds
      promptParts.push('background', 'high quality', 'detailed', 'landscape')
      
      // Combine all parts (Qwen3 understands natural language well)
      const fullPrompt = promptParts.join(', ')

      // Modify workflow nodes - use the same node IDs as avatar generation
      if (workflow[settings.positivePromptNodeId]) {
        workflow[settings.positivePromptNodeId].inputs.text = fullPrompt
      } else {
        return { success: false, error: `Positive prompt node ${settings.positivePromptNodeId} not found in workflow` }
      }

      // Randomize seed
      if (workflow[settings.samplerNodeId]) {
        const newSeed = Math.floor(Math.random() * 1125899906842624)
        workflow[settings.samplerNodeId].inputs.seed = newSeed
      }

      // Submit to ComfyUI
      const response = await fetch(`${settings.comfyUIUrl}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: workflow }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, error: `ComfyUI API error: ${errorText}` }
      }

      const result = await response.json()
      const promptId = result.prompt_id

      if (!promptId) {
        return { success: false, error: 'Failed to get prompt ID from ComfyUI' }
      }

      // Poll for completion
      let completed = false
      let attempts = 0
      const maxAttempts = 60 // 3 minutes max

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds

        const historyResponse = await fetch(`${settings.comfyUIUrl}/history/${promptId}`)
        if (!historyResponse.ok) {
          attempts++
          continue
        }

        const history = await historyResponse.json()

        if (history[promptId]) {
          completed = true
          const outputs = history[promptId].outputs

          if (outputs[settings.saveImageNodeId]?.images?.[0]) {
            const imageData = outputs[settings.saveImageNodeId].images[0]
            const comfyFilename = imageData.filename

            // Download the image
            const imageUrl = `${settings.comfyUIUrl}/view?filename=${comfyFilename}&type=output`
            const imageResponse = await fetch(imageUrl)

            if (!imageResponse.ok) {
              return { success: false, error: 'Failed to download generated image' }
            }

            const imageBlob = await imageResponse.blob()

            // Save to images directory
            // Add "bg " prefix, use spaces (no underscores), no dimensions
            const cleanPrompt = options.prompt.replace(/^bg\s+/i, '').trim()
            const sanitizedPrompt = cleanPrompt.toLowerCase().trim()
            const filename = `bg ${sanitizedPrompt}.png`
            const imagePath = `images/${filename}`

            // Convert blob to base64 for API call
            const arrayBuffer = await imageBlob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            // Try Electron API first (if running in Electron)
            if (typeof window !== 'undefined' && window.electronAPI) {
              try {
                // Ensure images directory exists
                const imagesDir = window.electronAPI.joinPath('images')
                const exists = await window.electronAPI.exists(imagesDir)
                if (!exists) {
                  await window.electronAPI.mkdir(imagesDir)
                }
                
                // Save image using writeFileBinary
                const fullPath = window.electronAPI.joinPath(imagesDir, filename)
                
                if (window.electronAPI.writeFileBinary) {
                  await window.electronAPI.writeFileBinary(fullPath, uint8Array)
                } else {
                  // Fallback: convert to base64
                  let binary = ''
                  for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i])
                  }
                  const base64 = btoa(binary)
                  await window.electronAPI.writeFile(fullPath, base64)
                }
                
                return { success: true, imagePath }
              } catch (error) {
                console.error('Error saving background image with Electron API:', error)
                // Fall through to HTTP API
              }
            }
            
            // Use HTTP API to save via Node.js server (for browser dev mode)
            try {
              // Convert to base64
              let binary = ''
              for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i])
              }
              const base64 = btoa(binary)
              const base64DataUrl = `data:image/png;base64,${base64}`
              
              const response = await fetch('/api/save-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  filename,
                  data: base64DataUrl,
                }),
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to save image')
              }
              
              const result = await response.json()
              return { success: true, imagePath: result.path || imagePath }
            } catch (error) {
              console.error('Error saving background image via API:', error)
              // Last resort: browser download
              const url = URL.createObjectURL(imageBlob)
              const a = document.createElement('a')
              a.href = url
              a.download = filename
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
              
              return { success: true, imagePath: url }
            }
          } else {
            return { success: false, error: `Save image node ${settings.saveImageNodeId} not found in workflow output` }
          }
        }

        attempts++
      }

      return { success: false, error: 'Generation timed out after 3 minutes' }
    } catch (error) {
      console.error('Background generation error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }
}

