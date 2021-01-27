import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Expr, Stmt, Type, Param} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to)),
      }
    case "Boolean":
      let bool = false;
      if(s.substring(c.from, c.to) === "True"){
        bool = true;
      }
      return {
        tag: "bool",
        value: bool,
      }
    case "None":
      return {
        tag: "none",
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "UnaryExpression":
      c.firstChild();
      const uniop = s.substring(c.from, c.to);
      c.nextSibling();
      const arg = traverseExpr(c, s);
      c.parent();
      return {
        tag: "uniop",
        op: uniop,
        value: arg
      }
    case "BinaryExpression":
      c.firstChild(); // first arg can be another expr
      const left = traverseExpr(c, s);
      // second arg should have node type ArithOp, which has only an operator
      c.nextSibling();
      const binop = s.substring(c.from, c.to);
      // then we have the third arg, which is the second binop
      c.nextSibling();
      const right = traverseExpr(c, s);
      // revert to original level
      c.parent();
      return {
        tag: "binop",
        left: left,
        op: binop,
        right: right
      };
    case "CallExpression":
      c.firstChild(); // call name "foo"
      const funcName = s.substring(c.from, c.to);
      c.nextSibling(); // arglist
      c.firstChild(); // "("
      c.nextSibling(); // 4+3 or either first arg or )
      let argList = [];
      while((c.node.type.name as string) !== ")"){
        argList.push(traverseExpr(c, s));
        c.nextSibling(); // , or )
        c.nextSibling(); // either next arg or )
      }
      c.parent();
      c.parent();
      // special case for print
      // it's very much hard-coded
      if(funcName === "print"){
        return {
          tag: "print",
          value: argList[0]
        }
      }
      return {
        tag: "call",
        name: funcName,
        args: argList
      }
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild();
      const name = s.substring(c.from, c.to);
      c.nextSibling();
      if((c.node.type.name as string) === "TypeDef"){
        c.firstChild();
        c.nextSibling();
        const type = s.substring(c.from, c.to);
        c.parent();
        c.nextSibling();
        c.nextSibling();
        const initVal = traverseExpr(c, s);
        c.parent();
        return {
          tag: "init",
          name: name,
          type: (type as Type),
          value: initVal
        }
      }
      else if((c.node.type.name as string) === "AssignOp"){
        c.nextSibling();
        const assignVal = traverseExpr(c, s);
        c.parent();
        return {
          tag: "assign",
          name: name,
          value: assignVal
        }
      }
    case "IfStatement":
      let elifcond = undefined;
      let elifstmts = [];
      let elsestmts = [];
      c.firstChild(); // if
      c.nextSibling(); // conditional
      const ifcond = traverseExpr(c, s);
      c.nextSibling(); // body
      c.firstChild(); // :
      c.nextSibling(); // statement 1 inside if
      // iterate through all of the statements
      let ifstmts = [];
      do {
        ifstmts.push(traverseStmt(c, s));
      } while(c.nextSibling());
      c.parent();
      c.nextSibling(); // can be elif or else from this point on
      if((c.node.type.name as string) === "elif"){
        c.nextSibling(); // condition
        elifcond = traverseExpr(c, s);
        c.nextSibling(); // body
        c.firstChild(); // :
        c.nextSibling(); // statements
        do {
          elifstmts.push(traverseStmt(c, s));
        } while(c.nextSibling());
        c.parent();
        c.nextSibling();
      }
      if((c.node.type.name as string) === "else"){
        c.nextSibling(); // body
        c.firstChild(); // :
        c.nextSibling(); // statements
        do {
          elsestmts.push(traverseStmt(c, s));
        } while(c.nextSibling());
        c.parent();
      }
      c.parent();
      return {
        tag: "if",
        ifcond: ifcond,
        if: ifstmts,
        elifcond: elifcond,
        elif: elifstmts,
        else: elsestmts
      }
    case "WhileStatement":
      c.firstChild(); // while
      c.nextSibling(); // cond
      const whilecond = traverseExpr(c, s);
      c.nextSibling(); // body
      c.firstChild(); // :
      c.nextSibling(); // stmt 1 inside if
      let whilestmts = [];
      // iterate through all stmts
      do {
        whilestmts.push(traverseStmt(c, s));
      } while(c.nextSibling());
      c.parent();
      c.parent();
      return {
        tag: "while",
        cond: whilecond,
        while: whilestmts
      }
    case "FunctionDefinition":
      c.firstChild(); // def 
      c.nextSibling(); // name of func 
      const funcName = s.substring(c.from, c.to);
      c.nextSibling(); // param list
      c.firstChild(); // ( first child of param list
      c.nextSibling(); // either name of first param or )
      let paramList = [];
      while((c.node.type.name as string) !== ")"){
        let paramName, paramType;
        paramName = s.substring(c.from, c.to);
        c.nextSibling(); // typedef ":int"
        c.firstChild(); // :
        c.nextSibling(); // type int
        paramType = s.substring(c.from, c.to);
        paramList.push({name: paramName, type: (paramType as Type)});
        c.parent();
        c.nextSibling(); // ,
        c.nextSibling(); // either name of next param or )
      }
      c.parent();
      c.nextSibling(); // typedef "-> int"
      let retType = "<None>";
      if((c.node.type.name as string) === "TypeDef"){
        c.firstChild(); // type int
        retType = s.substring(c.from, c.to);
        c.parent();
      }
      c.nextSibling(); // body
      c.firstChild(); // :
      c.nextSibling(); // the first body stmt
      let bodyStmts = [];
      do {
        bodyStmts.push(traverseStmt(c, s));
      } while(c.nextSibling());
      c.parent();
      c.parent();
      return {
        tag: "define",
        name: funcName,
        params: paramList,
        ret: (retType as Type),
        body: bodyStmts
      }
    case "ReturnStatement":
      c.firstChild(); // "return"
      c.nextSibling();
      let retExpr;
      // if no expr was supplied for return
      if((c.node.type.name as string) === "return"){
        retExpr = {tag: "none"};
      }
      else{
        retExpr = traverseExpr(c, s);
      }
      c.parent();
      return {
        tag: "return",
        // why do i need to cast this???
        expr: (retExpr as Expr)
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return {
        tag: "expr",
        expr: expr
      }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      const firstChild = c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
