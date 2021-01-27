import { forEachChild } from 'typescript';
import {Stmt, Expr, Type} from './ast';

export type Envs = {
    funcParams: Map<string, Array<Type>>,
    defEnv: Map<string, Type>
}

const emptyDefEnv = new Map<string, Type>();
const emptyFuncParams = new Map<string, Array<Type>>();
export const emptyEnvs = {funcParams: emptyFuncParams, defEnv: emptyDefEnv};

export function tcExpr(expr: Expr, envs: Envs) : Type {
    switch(expr.tag){
        case "none":
            return "<None>";
        case "bool":
            return "bool";
        case "num":
            return "int";
        case "id":
            return envs.defEnv.get(expr.name);
        case "call":

            if(!envs.funcParams.has(expr.name)){
                throw new Error(`Not a class or function: ${expr.name}`);
            }

            // check 2 things - check for correct num of args and each arg is of correct type
            const correctArgTypeList = envs.funcParams.get(expr.name);

            // correct num of args
            const argNums = expr.args.length;
            const correctArgNums = correctArgTypeList.length;
            if(argNums !== correctArgNums){
                throw new Error(`Expected ${correctArgNums} arguments; got ${argNums}`);
            }

            // each arg is of correct type
            const argTypeList = expr.args.map((arg) => { return tcExpr(arg, envs) });
            for(let argNum = 0; argNum < correctArgNums; argNum++){
                if(argTypeList[argNum] !== correctArgTypeList[argNum]){
                    throw new Error(`Expected type \`${correctArgTypeList[argNum]}\`; got type \`${argTypeList[argNum]}\` in parameter ${argNum}`)
                }
            }

            return envs.defEnv.get(expr.name);

        // insert type of data 
        case "print":
            const printType = tcExpr(expr.value, envs);
            return printType;

        case "uniop":
            const uniop = expr.op;
            const argType = tcExpr(expr.value, envs);
            if(uniop === "-"){
                if(argType === "int"){
                    return "int";
                }
                else{
                    throw new Error(`Cannot apply operator \`${uniop}\` on type \`${argType}\``);
                }
            }
            else if(uniop === "not"){
                if(argType === "bool"){
                    return "bool";
                }
                else{
                    throw new Error(`Cannot apply operator \`${uniop}\` on type \`${argType}\``);
                }
            }
            break;
        case "binop":
            const inNumOutNum = ["+", "-", "*", "//", "%"];
            const inNumOutBool = ["<=", ">=", "<", ">"];
            const returnBool = ["==", "!="];
            const noneBoth = ["is"];
            const leftType = tcExpr(expr.left, envs);
            const rightType = tcExpr(expr.right, envs);
            const binop = expr.op;
            if(inNumOutNum.includes(binop)){
                if((leftType === "int") && (rightType === "int")){
                    return "int";
                }
                else{
                    throw new Error(`Cannot apply operator \`${binop}\` on types \`${leftType}\` and \`${rightType}\``);
                }
            }
            else if(inNumOutBool.includes(binop)){
                if((leftType === "int") && (rightType === "int")){
                    return "bool";
                }
                else{
                    throw new Error(`Cannot apply operator \`${binop}\` on types \`${leftType}\` and \`${rightType}\``);
                }
            }
            else if(returnBool.includes(binop)){
                return "bool";
            }
            else if(noneBoth.includes(binop)){
                if((leftType === "<None>") && (rightType === "<None>")){
                    return "bool";
                }
                else{
                    throw new Error(`Cannot apply operator \`${binop}\` on types \`${leftType}\` and \`${rightType}\``);
                }
            }
            break;
    }
}

function tcInitStmts(stmts: Array<Stmt>, funcBody: boolean, envs : Envs) : Envs {
    let env = envs.defEnv;
    let funcParams = envs.funcParams;
    for(var stmt of stmts){
        switch(stmt.tag){
            case "init":
                const initName = stmt.name;
                if(env.has(initName) && (funcBody === false)){
                    throw new Error(`Duplicate declaration of identifier in same scope: ${initName}`);
                }
                const initType = tcExpr(stmt.value, {funcParams: funcParams, defEnv: env});
                env.set(initName, initType as Type);
                break;
            case "define":

                if(funcBody === true){
                    throw new Error(`Please define function \`${stmt.name}\` in the beginning of the program`);
                }

                const funcName = stmt.name;
                if(env.has(funcName) && (funcBody === false)){
                    throw new Error(`Duplicate declaration of identifier in same scope: ${funcName}`);
                }
                const retType = stmt.ret;
                env.set(funcName, retType);
                // build up an array that holds the types of each param
                let paramTypes = [];
                for(var param of stmt.params){
                    paramTypes.push(param.type);
                }
                funcParams.set(funcName, (paramTypes as Type[]));
                break;
        }
    }
    return {funcParams: funcParams, defEnv: env};
}

function tcStmt(stmt: Stmt, envs: Envs, funcDef: boolean) : Type {
    switch(stmt.tag){
        case "init":
            if(funcDef === false){
                throw new Error(`Please initialize variable \`${stmt.name}\` in the beginning of the program/function`);
            }
        case "define":
            throw new Error(`Please define function \`${stmt.name}\` in the beginning of the program`);
        case "return":
            if(funcDef === false){
                throw new Error(`Return statement cannot appear at the top level`);
            }
            return tcExpr(stmt.expr, envs);
        case "assign":
            const varName = stmt.name;
            const varType = envs.defEnv.get(varName);
            if(varType === undefined){
                throw new Error(`Not a variable: \`${varName}\``);
            }
            const assignType = tcExpr(stmt.value, envs);
            if(varType !== assignType){
                throw new Error(`Expected type \`${varType}\`; got type \`${assignType}\``);
            }
            break;
        case "if":
            const ifcondtype = tcExpr(stmt.ifcond, envs);
            stmt.if.map((stmt) => (tcStmt(stmt, envs, funcDef)));
            if(ifcondtype !== "bool"){
                throw new Error(`Condition expression cannot be of type \`${ifcondtype}\``);
            }
            if(stmt.elifcond !== undefined){
                const elifcondtype = tcExpr(stmt.elifcond, envs);
                stmt.elif.map((stmt) => (tcStmt(stmt, envs, funcDef)));
                if(elifcondtype !== "bool"){
                    throw new Error(`Condition expression cannot be of type \`${elifcondtype}\``);
                }
            }
            if(stmt.else.length !== 0){
                stmt.else.map((stmt) => (tcStmt(stmt, envs, funcDef)));
            }
            break;
        case "while":
            const whilecondtype = tcExpr(stmt.cond, envs);
            stmt.while.map((stmt) => (tcStmt(stmt, envs, funcDef)));
            if(whilecondtype !== "bool"){
                throw new Error(`Condition expression cannot be of type \`${whilecondtype}\``);
            }
            break;
        case "expr":
            return tcExpr(stmt.expr, envs);
    }
    return "notype";
}

export function tc(stmts: Array<Stmt>): Type {
    let returnType : Array<Type> = [];

    /*
    for(stmt of stmts){
        console.warn(`Tag of stmt: ${stmt.tag}`);
    }
    */

    // first, separate out all of the inits
    // by figuring out the subarray that contains all inits
    let notInitStmtIndex = 0;
    let funcStmts = []
    for(var stmt of stmts){
        // move to the next stmt if it's init or define
        if((stmt.tag === "init") || (stmt.tag === "define")){
            notInitStmtIndex++;

            // and if it is a func define, collect the body of the function
            if(stmt.tag === "define"){
                funcStmts.push(stmt);
            }
        }
        // else, exit from current for loop
        else{
            break;
        }
    }

    // the second index is exclusive so stmts[nISI] is not an init
    const initStmts = stmts.slice(0, notInitStmtIndex);
    const scriptStmts = stmts.slice(notInitStmtIndex);
    // this is the inital environment. it is meant to only gather info about top level inits
    let envs = tcInitStmts(initStmts, false, {defEnv: new Map<string, Type>(), funcParams: new Map<string, Array<Type>>()});
    for(var stmt of scriptStmts){
        let stmtType = tcStmt(stmt, envs, false);
        if(stmtType !== "notype"){
            returnType.push(stmtType);
        }
    }

    // now we iterate through the function stmts
    for(var funcStmt of funcStmts){
        let envCopy = envs;
        // first, add the local params into the copy
        for(var param of funcStmt.params){
            envCopy.defEnv.set(param.name, param.type);
        }
        // then iterate through the body
        let notInitStmtIndex = 0;
        let body = funcStmt.body;
        // split the init statements
        for(var bodyStmt of body){
            if(bodyStmt.tag === "init"){
                notInitStmtIndex++;
            }
            else{
                break;
            }
        }
        let funcInits = body.slice(0, notInitStmtIndex);
        let rest = body.slice(notInitStmtIndex);
        // collect all of the inits that are in the beginning of the function body
        const localDefs = tcInitStmts(funcInits, true, envCopy).defEnv;
        const funcEnv = {defEnv: localDefs, funcParams: envs.funcParams};
        const retTypes = rest.map((stmt) => { return tcStmt(stmt, funcEnv, true)} );
        // now, all return types must match with the correct type
        const correctRetType = funcStmt.ret;
        for(var retType of retTypes){
            if((retType !== "notype") && (retType !== correctRetType)){
                throw new Error(`Expected type \`${correctRetType}\`; got \`${retType}\``);
            }
        }
    }

    if(returnType.length === 0){
        return "<None>";
    }
    else{
        return returnType.pop();
    }
}