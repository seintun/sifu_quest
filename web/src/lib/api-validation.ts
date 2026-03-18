import { z } from 'zod'

// Chat route schemas
export const chatMessageSchema = z.object({
  role: z.string().min(1),
  content: z.string(),
})

export const chatPostSchema = z.object({
  messages: z.array(chatMessageSchema).optional(),
  mode: z.string().optional(),
  isGreeting: z.boolean().optional(),
  sessionId: z.string().uuid().nullable().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
})

// Chat session schemas
export const chatSessionGetSchema = z.object({
  mode: z.string().min(1, 'Mode is required'),
  before: z.string().optional().nullable(),
  beforeId: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(100).optional().nullable(),
  create_if_missing: z.literal('1').optional(),
})

export const chatSessionPostSchema = z.object({
  mode: z.string().min(1, 'Mode is required'),
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
})

// DSA log schema
export const dsaLogSchema = z.object({
  problem: z.string().min(1, 'Problem is required'),
  pattern: z.string().min(1, 'Pattern is required'),
  date: z.string().min(1, 'Date is required'),
  difficulty: z.string().optional(),
  notes: z.string().optional(),
  timeSpent: z.number().optional(),
  solution: z.string().optional(),
})

// Jobs schema
export const jobsAddActionSchema = z.object({
  action: z.literal('add'),
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  status: z.string().optional(),
  dateApplied: z.string().optional(),
  notes: z.string().optional(),
})

export const jobsUpdateStatusActionSchema = z.object({
  action: z.literal('updateStatus'),
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  newStatus: z.string().min(1, 'New status is required'),
})

export const jobsPostSchema = z.discriminatedUnion('action', [
  jobsAddActionSchema,
  jobsUpdateStatusActionSchema,
])

// Plan toggle schema
export const planToggleSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  checked: z.boolean('checked must be a boolean'),
})

// System design log schema
export const systemDesignLogSchema = z.object({
  concept: z.string().min(1, 'concept is required'),
  depthCovered: z.string().min(1, 'depthCovered is required'),
  notes: z.string().optional(),
})

// Account PATCH schema
export const accountPatchSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200, 'Full name must be 200 characters or fewer'),
})

// API key schemas
export const apiKeyPostSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  provider: z.enum(['anthropic', 'openrouter'], 'Provider must be "anthropic" or "openrouter"'),
})

export const apiKeyDeleteSchema = z.object({
  provider: z.enum(['anthropic', 'openrouter'], 'Provider must be "anthropic" or "openrouter"'),
})

// Internal plan jobs schema
export const planJobsRunSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().default(5),
})

// Memory GET schema
export const memoryGetSchema = z.object({
  file: z.string().min(1).optional(),
})

// Progress events GET schema
export const progressEventsGetSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
})

// Onboarding core complete schema
export const onboardingCoreCompleteSchema = z.object({
  core: z.record(z.string(), z.unknown()).optional(),
  enrichment: z.record(z.string(), z.unknown()).optional(),
  currentStep: z.number().int().min(0).optional(),
})

// Onboarding draft schema
export const onboardingDraftSchema = z.object({
  core: z.record(z.string(), z.unknown()).optional(),
  enrichment: z.record(z.string(), z.unknown()).optional(),
  currentStep: z.number().int().min(0).optional(),
})

// Onboarding enrichment schema
export const onboardingEnrichmentSchema = z.object({
  enrichment: z.record(z.string(), z.unknown()).optional(),
  currentStep: z.number().int().min(0).optional(),
})

// Onboarding (legacy) schema
export const onboardingLegacySchema = z.record(z.string(), z.unknown())

/**
 * Helper to return a 400 response with Zod validation errors.
 */
export function validationErrorResponse(error: z.ZodError) {
  return {
    error: 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}
