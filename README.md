# hcl.js

Utilities to work with HCL files in JavaScript

```typescript
const { hcl2json, treeSitterHcl } = require('hcl.js');
// https://github.com/tmccombs/hcl2json
hcl2json('a = 1').then(console.log); // { a: 1 }
// https://github.com/tree-sitter-grammars/tree-sitter-hcl
treeSitterHcl().then((parser) => {
  const tree = parser.parse('a = 1');
  console.log(tree.rootNode.toString());
});
```
