import { createArtifactPrompt } from '@/pages/ArtifactsPage/artifact-prompt'

// The router waits for consent before it can mount the destination page.
export const legacyArtifactShareDialogs = createArtifactPrompt()
