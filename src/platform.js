// Where the app is running. The installed app and a normal browser tab get the
// defaults. A host that cannot save files (for example a sandboxed preview page)
// sets `globalThis.__MOVE_PREVIEW__ = true` before the app starts.

export const isPreview = () => Boolean(globalThis.__MOVE_PREVIEW__);
