// STORY.md is parsed at build time by story/plugin.ts.
declare module '*/STORY.md' {
  const story: import('../story/parse.ts').Story
  export default story
}
