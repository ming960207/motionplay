export const MOTION_ACTIONS = ['JUMP', 'DUCK', 'LEFT', 'RIGHT', 'NEUTRAL'] as const
export type MotionAction = (typeof MOTION_ACTIONS)[number]

export type MotionMessage = {
  type: 'motion'
  sequence: number
  timestamp: number
  action: MotionAction
  confidence: number
}

export function parseMotionMessage(value: unknown): MotionMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Motion message must be an object')
  }
  const data = value as Record<string, unknown>
  if (data.type !== 'motion' ||
      typeof data.sequence !== 'number' || !Number.isSafeInteger(data.sequence) || data.sequence < 0 ||
      typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp) ||
      !MOTION_ACTIONS.includes(data.action as MotionAction) ||
      typeof data.confidence !== 'number' || !Number.isFinite(data.confidence) ||
      data.confidence < 0 || data.confidence > 1) {
    throw new Error('Invalid motion message')
  }
  return data as MotionMessage
}
