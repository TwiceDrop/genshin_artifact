const path = require('path')
module.exports = {
  prefix: 'm-',
  content: [path.join(__dirname, '../src/mobile/**/*.{js,vue}')],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: Object.fromEntries(['background','foreground','primary','primary-foreground','secondary','secondary-foreground','destructive','destructive-foreground','accent','input'].map(name=>[name,`hsl(var(--${name}))`])),
    },
  },
}
