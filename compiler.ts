import { stringInput } from "lezer-tree";
import { Stmt, Expr} from "./ast";
import { parse } from "./parser";
import { emptyEnvs, tcExpr } from "./typecheck";

// https://learnxinyminutes.com/docs/wasm/
let stackcount = 0;

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  offset: number;
}

export const emptyEnv = { globals: new Map(), offset: 0 };

export function getStackcount() : number{
  return stackcount;
}

export function resetStackcount(){
  stackcount = 0;
}

export function augmentEnv(env: GlobalEnv, stmts: Array<Stmt>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  var newOffset = env.offset;
  stmts.forEach((s) => {
    switch(s.tag) {
      case "init":
        newEnv.set(s.name, newOffset);
        newOffset += 1;
        break;
    }
  })
  return {
    globals: newEnv,
    offset: newOffset
  }
}

type CompileResult = {
  funcDefs: string,
  wasmSource: string,
  newEnv: GlobalEnv
};

export function compile(source: string, env: GlobalEnv) : CompileResult {
  const ast = parse(source);
  const withDefines = augmentEnv(env, ast);

  // separate the script of function definitions
  let funcDefs = [];
  let nonFuncDefs = [];
  for(var stmt of ast){
    if(stmt.tag === "define"){
      funcDefs.push(stmt);
    }
    else{
      nonFuncDefs.push(stmt);
    }
  }
  
  const defGroups = funcDefs.map((stmt) => codeGen(stmt, withDefines, true));
  const defs = [].concat.apply([], defGroups);
  const commandGroups = nonFuncDefs.map((stmt) => codeGen(stmt, withDefines, false));
  const commands = [].concat.apply([], commandGroups);
  return {
    funcDefs: defs.join("\n"),
    wasmSource: commands.join("\n"),
    newEnv: withDefines
  };
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}

function codeGen(stmt: Stmt, env: GlobalEnv, funcDef: boolean) : Array<string> {
  let blockType = "";
  switch(stmt.tag) {
    case "pass":
      return ["(nop)"];
    case "init":
      if(funcDef === true){
        var valStmts = codeGenExpr(stmt.value, env, funcDef);
        valStmts.push(`(local.set $${stmt.name})`);
        return valStmts;
      }
      else{
        const initLocationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        var valStmts = codeGenExpr(stmt.value, env, funcDef);
        return initLocationToStore.concat(valStmts).concat([`(i32.store)`]);
      }
    case "assign":
      if(funcDef === true){
        var valStmts = codeGenExpr(stmt.value, env, funcDef);
        valStmts.push(`(local.set $${stmt.name})`);
        return valStmts;
      }
      else{
        const assignLocationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        var valStmts = codeGenExpr(stmt.value, env, funcDef);
        return assignLocationToStore.concat(valStmts).concat([`(i32.store)`]);
      }
    case "if":
      // this will involve a lot of hardcoding...
      // i pray that this won't have to generalize to variable amount of elifs
      const ifStmts = stmt.if.reduce((arr, ifStmt) => { return arr.concat(codeGen(ifStmt, env, funcDef)) }, []).join('\n');
      const elifStmts = stmt.elif.reduce((arr, elifStmt) => { return arr.concat(codeGen(elifStmt, env, funcDef)) }, []).join('\n');
      const elseStmts = stmt.else.reduce((arr, elseStmt) => { return arr.concat(codeGen(elseStmt, env, funcDef)) }, []).join('\n');
      const ifcond = codeGenExpr(stmt.ifcond, env, funcDef).join('\n');
      if(funcDef === true){
        blockType = "(result i32)"
      }
      if(stmt.elifcond !== undefined){
        const elifcond = codeGenExpr(stmt.elifcond, env, funcDef).join('\n');
        let ret = 
        [`(block ${blockType}
            (block
              (block
                ${ifcond}
                (br_if 0)
                ${elifcond}
                (br_if 1)
                ${elseStmts}
                (br 2))
              ${ifStmts}
              (br 1))
            ${elifStmts})`];
        return ret;
      }
      else{      
        let ret =
        [`(block ${blockType}
            (block
              ${ifcond}
              (br_if 0)
              ${elseStmts}
              (br 1))
            ${ifStmts})`];
        return ret;
      }
    case "while":
      const whilecond = codeGenExpr(stmt.cond, env, funcDef).join('\n');
      const negatedcond = codeGenExpr({tag: "uniop", op: "not", value: stmt.cond}, env, funcDef).join('\n');
      const whileStmts = stmt.while.reduce((arr, whileStmt) => { return arr.concat(codeGen(whileStmt, env, funcDef)) }, []).join('\n');
      if(funcDef === true){
        blockType = "(result i32)"
      }
      let ret =
      [`(block
          ${negatedcond}
          (br_if 0)
          (loop
            ${whileStmts}
            ${whilecond}
            (br_if 0)
            (br 1)))`]
      return ret;
    // TODO: finish this later
    case "define":
      let funcParams = stmt.params.map((param) => `(param $${param.name} i32)`).join(" ");
      let funcBody = stmt.body.reduce((arr, stmt) => { return arr.concat(codeGen(stmt, env, funcDef)) }, []).join('\n');
      return [`(func $${stmt.name} ${funcParams} (result i32) ${funcBody})`]
    case "return":
      let toReturn = codeGenExpr(stmt.expr, env, funcDef);
      toReturn.push("return");
      return toReturn;
    /*
    case "print":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        "(call $print)"
      ]);
    */
    case "expr":
      return codeGenExpr(stmt.expr, env, funcDef);
  }
}

function codeGenExpr(expr : Expr, env: GlobalEnv, funcDef: boolean) : Array<string> {
  switch(expr.tag) {
    // each get or define constant adds 1 to stack count
    case "none":
      stackcount++;
      return ["(i32.const 0)"];
    case "bool":
      stackcount++;
      switch(expr.value){
        case false:
          return ["(i32.const 0)"];
        case true:
          return ["(i32.const 1)"];
      }
    case "num":
      stackcount++;
      return ["(i32.const " + expr.value + ")"];
    case "id":
      // this can be local or global...
      stackcount++;
      if(funcDef === true){
        return [`(local.get $${expr.name})`];
      }
      else {
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i32.load)`];
      }
    case "call":
      let callStmts = expr.args.reduce((arr, arg) => {return arr.concat(codeGenExpr(arg, env, funcDef))}, []);
      // this depends on the number of params.
      // we're removing num arg things on stack and pushing back 1.
      stackcount = stackcount - expr.args.length + 1
      callStmts.push(`(call $${expr.name})`);
      return callStmts;
    case "print":
      const printExpr = codeGenExpr(expr.value, env, funcDef);
      let printType = tcExpr(expr.value, emptyEnvs);
      let out = [].concat(printExpr);
      if(printType === "int"){
        out.push(`(call $printint)`);
      }
      else if(printType === "bool"){
        out.push(`(call $printbool)`);
      }
      // print removes from stack
      stackcount--;
      return out;
    case "uniop":
      return codeGenUniop(expr.op, expr.value, env, funcDef);
    case "binop":
      return codeGenBinop(expr.op, expr.left, expr.right, env, funcDef);
  }
}

function codeGenUniop(op: string, arg: Expr, env: GlobalEnv, funcDef: boolean): Array<string> {
  var argStmts = codeGenExpr(arg, env, funcDef);
  let opStmt;

  switch(op){
    case "not":
      opStmt = ["(i32.const 1)", "(i32.add)", "(i32.const 2)", "(i32.rem_s)"];
      break;
    case "-":
      opStmt = ["(i32.const -1)", "(i32.mul)"];
      break;
    default:
      throw new Error(`Unown uniop: ${op}`);
  }
  // stack count doesn't change
  return argStmts.concat(opStmt);
}

function codeGenBinop(op: string, left: Expr, right: Expr, env: GlobalEnv, funcDef: boolean): Array<string> {
  var leftStmts = codeGenExpr(left, env, funcDef);
  var rightStmts = codeGenExpr(right, env, funcDef);
  let opStmt;

  switch(op){
    case "+":
      opStmt = ["(i32.add)"];
      break;
    case "-":
      opStmt = ["(i32.sub)"];
      break;
    case "*":
      opStmt = ["(i32.mul)"];
      break;
    case "//":
      opStmt = ["(i32.div_s)"];
      break;
    case "%":
      opStmt = ["(i32.rem_s)"];
      break;
    case "<":
      opStmt = ["(i32.lt_s)"];
      break;
    case "<=":
      opStmt = ["(i32.le_s)"];
      break;
    case ">":
      opStmt = ["(i32.gt_s)"];
      break;
    case "<=":
      opStmt = ["(i32.ge_s)"];
      break;
    case "!=":
      opStmt = ["(i32.ne)"];
      break;
    case "==":
      opStmt = ["(i32.eq)"];
      break;
    // eq for now cuz only None is None works, others fail tc
    case "is":
      opStmt = ["(i32.eq)"];
      break;
    default:
     throw new Error(`Unown binop: ${op}`);
  }
  // each binop pops two and pushes one, so -1
  stackcount--;
  return leftStmts.concat(rightStmts, opStmt);
  
}