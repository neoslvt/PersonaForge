import { Character, Scene, DialogNode } from '../types/models'
import { useSettingsStore } from '../store/settingsStore'

interface AIService {
  generateNPCResponse(
    context: string,
    character?: Character,
    scene?: Scene
  ): Promise<string>
}

class OpenAIService implements AIService {
  async generateNPCResponse(
    context: string,
    character?: Character,
    scene?: Scene,
    dialogNodes?: Record<string, DialogNode>,
    currentNodeId?: string
  ): Promise<string> {
    const settings = useSettingsStore.getState().aiSettings
    
    if (!settings.openAIToken) {
      throw new Error('OpenAI API token is not set. Please configure it in Settings.')
    }

    const systemPrompt = this.buildSystemPrompt(character, scene)
    
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

  private buildSystemPrompt(character?: Character, scene?: Scene): string {
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

    prompt += '\nGuidelines:\n'
    prompt += '- Keep responses short and concise, like a real person would speak\n'
    prompt += '- Stay highly in character at all times\n'
    prompt += '- Avoid overusing emojis or special characters\n'
    prompt += '- Respond naturally and conversationally\n'
    prompt += '- Maintain consistency with the character\'s personality'

    return prompt
  }
}

let aiServiceInstance: AIService | null = null

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new OpenAIService()
  }
  return aiServiceInstance
}
