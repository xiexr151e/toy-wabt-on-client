// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';
import { Type, Expr } from './ast';
import { parse } from './parser';
import { tc } from "./typecheck";

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

function convertResult(result: any, type: Type) : any {
  //console.warn(`Result: ${result}, Type: ${type}`);
  if(type === "bool"){
    if(result === 1){
      return "True";
    }
    else{
      return "False";
    }
  }
  else if(type === "int"){
    return result;
  }
  else if ((type === "<None>") && (result === 0)){
    return "None";
  }
  else{
    return 0;
  }
}

export async function run(source : string, config: any) : Promise<[any, compiler.GlobalEnv]> {
  const wabtInterface = await wabt();
  const parsed = parse(source);
  // tentative call to typecheck
  const outType = tc(parsed);
  var returnType = "";
  var dummy = "";
  if(parsed[parsed.length - 1].tag === "expr") {
    returnType = "(result i32)";
  }
  const compiled = compiler.compile(source, config.env);
  const importObject = config.importObject;
  //console.warn(`There are ${compiler.getStackcount()} things on the stack`);
  if(compiler.getStackcount() === 0){
    dummy = "(i32.const 0)";
  }
  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:10, maximum:100});
    importObject.js = { memory: memory };
  }
  const wasmSource = `(module
    (func $print (import "imports" "imported_func") (param i32))
    (func $printglobal (import "imports" "print_global_func") (param i32) (param i32))
    (func $printint (import "imports" "print_int") (param i32))
    (func $printbool (import "imports" "print_bool") (param i32))
    (import "js" "memory" (memory 1))
    ${compiled.funcDefs}
    (func (export "exported_func") ${returnType}
      ${compiled.wasmSource}
      ${dummy}
    )
  )`;
  //console.warn(wasmSource);
  compiler.resetStackcount();
  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  const convertedResult = convertResult(result, outType);
  return [convertedResult, compiled.newEnv];
}
