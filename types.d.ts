import type Parser from "tree-sitter";

// https://github.com/tmccombs/hcl2json
export function hcl2json(sourceCode: string): Promise<object>;
// https://github.com/tree-sitter-grammars/tree-sitter-hcl
export function treeSitterHcl(): Promise<Parser>;
