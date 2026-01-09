import { Character, Scene, DialogNode } from '../types/models'
import { useSettingsStore } from '../store/settingsStore'

interface AIService {
  generateNPCResponse(
    context: string,
    character?: Character,
    scene?: Scene,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<string>
  detectEmotion(
    response: string,
    character?: Character,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<string>
  analyzeAndCreateNodes(
    response: string,
    character?: Character,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<Array<{ type: 'setVariable'; variableName: string; variableValue: string | number } | { type: 'changeVariable'; variableName: string; variableOperation: 'add' | 'subtract'; variableValue: number }>>
}

class OpenAIService implements AIService {
  async generateNPCResponse(
    context: string,
    character?: Character,
    scene?: Scene,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<string> {
    const settings = useSettingsStore.getState().aiSettings
    
    if (!settings.openAIToken) {
      throw new Error('OpenAI API token is not set. Please configure it in Settings.')
    }

    const systemPrompt = this.buildSystemPrompt(character, scene, variables, sceneDescriptions)
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    if (context && context.trim() !== '') {
      const messageParts = context.split('\n\n')
      for (const part of messageParts) {
        if (part.trim()) {
          const match = part.match(/^(NPC|Player):\s*(.+)$/s)
          if (match) {
            const [, speaker, text] = match
            if (speaker === 'NPC') {
              messages.push({ role: 'assistant', content: text.trim() })
            } else if (speaker === 'Player') {
              messages.push({ role: 'user', content: text.trim() })
            }
          }
        }
      }
    } else {
      throw new Error('No conversation context available. Please ensure nodes are properly connected in the dialog tree.')
    }

    const response = await fetch(settings.openAIUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openAIToken}`,
      },
      body: JSON.stringify({
        model: settings.openAIModel || 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.8,
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
      )
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || 'No response generated'
  }

  private buildSystemPrompt(
    character?: Character, 
    scene?: Scene,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): string {
    let prompt = 'You are an NPC in an interactive dialog system. Respond naturally and in character.\n\n'

    if (character) {
      prompt += `Character: ${character.name}\n`
      if (character.personality) {
        prompt += `Personality: ${character.personality}\n`
      }
    }

    if (scene) {
      prompt += `\nScene Context: ${scene.description}\n`
    }

    // Always include scene descriptions section (even if empty, so AI knows to consider them)
    prompt += `\nScene Descriptions:\n`
    if (sceneDescriptions && sceneDescriptions.length > 0) {
      sceneDescriptions.forEach((desc, index) => {
        prompt += `${index + 1}. ${desc}\n`
      })
    } else {
      prompt += `(None specified)\n`
    }

    // Always include variables section (even if empty, so AI knows to consider them)
    prompt += `\nCurrent Variables/State:\n`
    if (variables && Object.keys(variables).length > 0) {
      for (const [key, value] of Object.entries(variables)) {
        prompt += `- ${key} = ${value}\n`
      }
    } else {
      prompt += `(No variables set)\n`
    }

    prompt += '\nGuidelines:\n'
    prompt += '- Keep responses short and concise, like a real person would speak\n'
    prompt += '- Stay highly in character at all times\n'
    prompt += '- Avoid overusing emojis or special characters\n'
    prompt += '- Respond naturally and conversationally\n'
    prompt += '- Maintain consistency with the character\'s personality\n'
    prompt += '- Consider the current variables and scene when responding'

    return prompt
  }

  async detectEmotion(
    response: string,
    character?: Character,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<string> {
    const settings = useSettingsStore.getState().aiSettings
    
    if (!settings.openAIToken) {
      throw new Error('OpenAI API token is not set. Please configure it in Settings.')
    }

    const emotions = ['excited', 'horny', 'flirt', 'very happy', 'happy cry', 'shy', 'happy', 'neutral', 'questioning', 'thinking', 'surprised', 'confused', 'disappointed', 'angry', 'little sad', 'sad', 'cry']
    
    let prompt = `Analyze the following NPC response and determine the emotion/mood. Consider the character's personality, current variables, and scene context.\n\n`
    
    if (character) {
      prompt += `Character: ${character.name}\n`
      if (character.personality) {
        prompt += `Personality: ${character.personality}\n`
      }
    }

    if (variables && Object.keys(variables).length > 0) {
      prompt += `\nCurrent Variables:\n`
      for (const [key, value] of Object.entries(variables)) {
        prompt += `- ${key} = ${value}\n`
      }
    }

    if (sceneDescriptions && sceneDescriptions.length > 0) {
      prompt += `\nScene Descriptions:\n`
      sceneDescriptions.forEach((desc, index) => {
        prompt += `${index + 1}. ${desc}\n`
      })
    }

    prompt += `\nNPC Response: "${response}"\n\n`
    prompt += `Based on the character's personality, the current situation (variables and scene), and the tone/content of the response, determine the most appropriate emotion from this list: ${emotions.join(', ')}\n\n`
    prompt += `Respond with ONLY the emotion name, nothing else.`

    const messages = [
      { role: 'system', content: 'You are an emotion detection system. Analyze text and return only the emotion name.' },
      { role: 'user', content: prompt }
    ]

    const aiResponse = await fetch(settings.openAIUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openAIToken}`,
      },
      body: JSON.stringify({
        model: settings.openAIModel || 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.3,
        max_tokens: 20,
      }),
    })

    if (!aiResponse.ok) {
      console.warn('Failed to detect emotion, defaulting to neutral')
      return 'neutral'
    }

    const data = await aiResponse.json()
    const detectedEmotion = (data.choices[0]?.message?.content || 'neutral').trim().toLowerCase()
    
    // Validate the emotion is in our list
    return emotions.includes(detectedEmotion) ? detectedEmotion : 'neutral'
  }

  async analyzeAndCreateNodes(
    response: string,
    character?: Character,
    variables?: Record<string, string | number>,
    sceneDescriptions?: string[]
  ): Promise<Array<{ type: 'setVariable'; variableName: string; variableValue: string | number } | { type: 'changeVariable'; variableName: string; variableOperation: 'add' | 'subtract'; variableValue: number }>> {
    const settings = useSettingsStore.getState().aiSettings
    
    if (!settings.openAIToken) {
      return []
    }

    let prompt = `Analyze the following NPC response and determine if any variables should be set or changed based on what the NPC said or did.\n\n`
    
    if (character) {
      prompt += `Character: ${character.name}\n`
    }

    if (variables && Object.keys(variables).length > 0) {
      prompt += `\nCurrent Variables:\n`
      for (const [key, value] of Object.entries(variables)) {
        prompt += `- ${key} = ${value}\n`
      }
    }

    if (sceneDescriptions && sceneDescriptions.length > 0) {
      prompt += `\nScene Descriptions:\n`
      sceneDescriptions.forEach((desc, index) => {
        prompt += `${index + 1}. ${desc}\n`
      })
    }

    prompt += `\nNPC Response: "${response}"\n\n`
    prompt += `Based on this response, determine if any variables should be set or changed. For example:\n`
    prompt += `- If NPC says "I ate all your apples", set user_apples to 0\n`
    prompt += `- If NPC gives the player something, increase player inventory\n`
    prompt += `- If NPC takes something, decrease the relevant variable\n\n`
    prompt += `Respond with a JSON array of actions. Each action should be:\n`
    prompt += `- {"type": "setVariable", "variableName": "var_name", "variableValue": value} for setting a variable\n`
    prompt += `- {"type": "changeVariable", "variableName": "var_name", "variableOperation": "add" or "subtract", "variableValue": number} for changing a variable\n`
    prompt += `If no variables should be changed, return an empty array [].\n`
    prompt += `Only return the JSON array, nothing else.`

    const messages = [
      { role: 'system', content: 'You are a variable analysis system. Analyze NPC responses and determine variable changes. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ]

    try {
      const aiResponse = await fetch(settings.openAIUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openAIToken}`,
        },
        body: JSON.stringify({
          model: settings.openAIModel || 'gpt-3.5-turbo',
          messages: messages,
          temperature: 0.3,
          max_tokens: 500,
        }),
      })

      if (!aiResponse.ok) {
        console.warn('Failed to analyze for node creation')
        return []
      }

      const data = await aiResponse.json()
      const content = data.choices[0]?.message?.content || '[]'
      
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const actions = JSON.parse(jsonMatch[0])
        return Array.isArray(actions) ? actions : []
      }
      
      return []
    } catch (error) {
      console.warn('Error parsing node creation analysis:', error)
      return []
    }
  }
}

let aiServiceInstance: AIService | null = null

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new OpenAIService()
  }
  return aiServiceInstance
}
