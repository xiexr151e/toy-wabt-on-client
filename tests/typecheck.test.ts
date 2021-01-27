import * as mocha from 'mocha';
import {expect} from 'chai';
import {tc, tcExpr, Envs, emptyEnvs} from '../typecheck';
import {parse, traverseExpr} from '../parser';
import {parser} from 'lezer-python';
import {Type, Expr} from '../ast';

let env : Envs;

function sourceToExpr(source : string): Expr {
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();
    return traverseExpr(cursor, source);
}

before(() => {env = emptyEnvs});
describe('no errors in tcExpr', () => {
    it('incorrect type for binops that need numbers', () => {
        const expr = sourceToExpr('4 + 5');
        expect(tcExpr(expr, env)).to.deep.equal(`int`);
    })

    it('multiple binops', () => {
        const expr = sourceToExpr('4 * 5 + 6 <= 7 * 8 % 9');
        expect(tcExpr(expr, env)).to.deep.equal(`bool`);
    })

    it('multiple function calls', () => {
        env.funcParams.set("foo", ["int"]);
        env.funcParams.set("bar", ["int"]);
        env.defEnv.set("foo", "int");
        env.defEnv.set("bar", "int");
        const expr = sourceToExpr('foo(5) != bar(5)');
        expect(tcExpr(expr, env)).to.deep.equal(`bool`);
    })

    it('nested function calls', () => {
        env.funcParams.set("foo", ["int"]);
        env.funcParams.set("bar", ["int"]);
        env.defEnv.set("foo", "int");
        env.defEnv.set("bar", "int");
        const expr = sourceToExpr('foo(bar(5))');
        expect(tcExpr(expr, env)).to.deep.equal(`int`);
    })
})

describe('errors in tcExpr', () => {
    it('incorrect type for binop that need numbers', () => {
        const expr = sourceToExpr('True + 5');
        expect(() => tcExpr(expr, env)).to.throw(`Cannot apply operator \`+\` on types \`bool\` and \`int\``);
    })

    it('incorrect type for uniop that need number', () => {
        const expr = sourceToExpr('-False');
        expect(() => tcExpr(expr, env)).to.throw(`Cannot apply operator \`-\` on type \`bool\``);
    })

    it('incorrect number of args', () => {
        env.funcParams.set("foo", []);
        env.defEnv.set("foo", "int");
        const expr = sourceToExpr('foo(6)');
        expect(() => tcExpr(expr, env)).to.throw(`Expected 0 arguments; got 1`);
    })

    it('incorrect arg type', () => {
        env.funcParams.set("foo", ["int", "int"]);
        env.defEnv.set("foo", "int");
        const expr = sourceToExpr('foo(5 + 6 * 7, 80 != 79)');
        expect(() => tcExpr(expr, env)).to.throw(`Expected type \`int\`; got type \`bool\` in parameter 1`);
    })
})

describe('errors in tc', () => {
    it('dupe initialization', () => {
        const source =
        `
        x:int=5
        x:int=6
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Duplicate declaration of identifier in same scope: x`);
    })

    it('assign without initialization', () => {
        const source =
        `
        x=5
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Not a variable: \`x\``);
    })

    it('wrong type assigned', () => {
        const source =
        `
        x:int=5
        x=False
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Expected type \`int\`; got type \`bool\``);
    })

    it('not bool in if', () => {
        const source =
        `
        if 6:
            True
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Condition expression cannot be of type \`int\``);
    })

    it('not bool in elif', () => {
        const source =
        `
        if False:
            True
        elif None:
            False
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Condition expression cannot be of type \`<None>\``);
    })

    it('nested elif', () => {
        const source =
        `
        if True:
            5
        elif False:
            if 6:
                7
        else:
            8
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Condition expression cannot be of type \`int\``);
    })

    it('init in the wrong place', () => {
        const source =
        `
        6
        x:int=5
        `
        const ast = parse(source);
        expect(() => tc(ast)).to.throw(`Please initialize variable \`x\` in the beginning of the program/function`);
    })
})

describe('no errors in tc', () => {

    it('define and call foo', () => {
        const source =
        `
        def foo() -> int:
            return 6
        foo()
        `
        const ast = parse(source);
        expect(tc(ast)).to.deep.equal('int');
    })

    it('mutual recursion', () => {
        console.warn("mutual recursion");
        const source =
        `
        def is_even(n: int) -> bool:
            if n == 0:
                return True
            else:
                return is_odd(n-1)
        def is_odd(n: int) -> bool:
            if n == 0:
                return False
            else:
                return is_even(n-1)
        is_odd(6)
        `
        const ast = parse(source);
        expect(tc(ast)).to.deep.equal('bool');
    })

    it('def add1 (1 arg)', async() => {
        let source =
        `
        def add1(x:int) -> int:
          return x + 1
        add1(5)
        `
        const ast = parse(source);
        expect(tc(ast)).to.equal('int');
      })
})