import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizePath, searchForWorkspaceRoot, type Plugin } from 'vite'
import { parseStory } from './parse.ts'

// STORY.md at the repository root is the source of the screen texts.
const STORY_PATH = normalizePath(fileURLToPath(new URL('../../STORY.md', import.meta.url)))

// Turns `import story from '.../STORY.md'` into the parsed texts. A broken document fails
// the build; the dev server shows the error and picks up every save.
export default function story(): Plugin {
  return {
    name: 'story',
    config: () => ({
      // the dev server serves files outside the frontend only when allowed
      server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), STORY_PATH] } },
    }),
    load(id) {
      if (normalizePath(id.split('?')[0]) !== STORY_PATH) return
      this.addWatchFile(STORY_PATH)
      return `export default ${JSON.stringify(parseStory(readFileSync(STORY_PATH, 'utf8')))}`
    },
  }
}
