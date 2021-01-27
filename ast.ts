export type Stmt = 
    {tag: "assign", name: string, value: Expr}
  | {tag: "init", name: string, type: Type, value: Expr}
  | {tag: "define", name: string, params: Array<Param>, ret: Type, body: Array<Stmt>}
  | {tag: "if", ifcond: Expr, if: Array<Stmt>, elifcond?: Expr, elif?: Array<Stmt>, else?: Array<Stmt>}
  | {tag: "while", cond: Expr, while: Array<Stmt>}
  | {tag: "pass"}
  | {tag: "return", expr: Expr}
  | {tag: "expr", expr: Expr}

export type Expr =
    {tag: "none"}
  | {tag: "bool", value: boolean}
  | {tag: "num", value: number}
  | {tag: "id", name: string}
  | {tag: "uniop", op: string, value: Expr}
  | {tag: "binop", op: string, left: Expr, right: Expr}
  | {tag: "call", name: string, args: Array<Expr>}
  | {tag: "print", value: Expr}

export type Param = {name: string, type: Type}

export type Type = "int" | "bool" | "<None>" | "notype";