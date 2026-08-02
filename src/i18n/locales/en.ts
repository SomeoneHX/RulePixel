export default {
  tools: {
    pen: 'Pen',
    eraser: 'Eraser',
    bucket: 'Fill area',
    undo: 'Undo',
    redo: 'Redo',
    clear: 'Clear canvas',
  },
  actions: {
    import: 'Import',
    copy: 'Copy',
    copied: 'Copied',
    export: 'Export',
    download: 'Download LaTeX file',
    copyLatex: 'Copy LaTeX',
    reset: 'Reset canvas',
    copyCode: 'Copy code',
    copiedToClipboard: 'Copied to clipboard',
  },
  canvas: {
    title: 'Pixel canvas',
    instruction: 'Click or drag to draw',
    pixel: 'Pixel {row}, {column}',
  },
  color: {
    title: 'Color',
    custom: 'Custom color',
  },
  settings: {
    title: 'Canvas settings',
    width: 'Width',
    height: 'Height',
    ruleSize: 'Rule size',
    lineCorrection: 'Line correction',
    auto: 'Auto',
    custom: 'Custom',
    largeCanvasWarning: 'This canvas contains {count} pixels. Pasting into some rich-text editors may trigger RangeError: Maximum call stack size exceeded.',
  },
  preview: {
    title: 'Rendered preview',
    ready: 'KaTeX ready',
  },
  output: {
    title: 'LaTeX output',
    expandFunction: 'Expand function',
    expandHint: 'Some editors may stop rendering when too many function calls are used. Try enabling this if you encounter problems.',
  },
  language: {
    switchTo: 'Switch language',
    chinese: '中文',
    english: 'EN',
  },
}
