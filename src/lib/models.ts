import { z } from "zod"

export const modelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  contextWindow: z.number(),
  capability: z.enum(["basic", "reasoning", "research"]),
  pricing: z.object({
    input: z.string(),
    output: z.string(),
  }),
})

export type Model = z.infer<typeof modelSchema>

export const sonarModels: Model[] = [
  {
    id: "sonar-pro",
    name: "Sonar Pro",
    description: "Most capable model with extended 200k context window",
    contextWindow: 200000,
    capability: "basic",
    pricing: {
      input: "$0.0015",
      output: "$0.0075",
    },
  },
  {
    id: "sonar-deep-research",
    name: "Sonar Deep Research",
    description: "Specialized for comprehensive research and analysis",
    contextWindow: 128000,
    capability: "research",
    pricing: {
      input: "$0.0020",
      output: "$0.0100",
    },
  },
  {
    id: "sonar-reasoning-pro",
    name: "Sonar Reasoning Pro",
    description: "Advanced reasoning with enhanced accuracy",
    contextWindow: 128000,
    capability: "reasoning",
    pricing: {
      input: "$0.0015",
      output: "$0.0075",
    },
  },
  {
    id: "sonar-reasoning",
    name: "Sonar Reasoning",
    description: "Core reasoning capabilities at a lower cost",
    contextWindow: 128000,
    capability: "reasoning",
    pricing: {
      input: "$0.0010",
      output: "$0.0050",
    },
  },
  {
    id: "sonar",
    name: "Sonar",
    description: "Fast and efficient base model",
    contextWindow: 128000,
    capability: "basic",
    pricing: {
      input: "$0.0005",
      output: "$0.0025",
    },
  },
]

export async function fetchModels(apiKey?: string): Promise<Model[]> {
  // For now just return static models since Perplexity doesn't have a models endpoint
  return sonarModels
}
