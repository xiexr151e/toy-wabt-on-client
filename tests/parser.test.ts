import * as mocha from 'mocha';
import {expect} from 'chai';
import { parser } from 'lezer-python';
import { traverseExpr, traverseStmt, traverse, parse } from '../parser';
import { Stmt, Expr } from "../ast";
import { TreeCursor } from 'lezer-tree';

// We write tests for each function in parser.ts here. Each function gets its 
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected. 
describe('traverseExpr(c, s) function', () => {
  it('parses a number in the beginning', () => {
    const source = "987";
    const cursor = parser.parse(source).cursor();

    // go to statement
    cursor.firstChild();
    // go to expression
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);

    // Note: we have to use deep equality when comparing objects
    expect(parsedExpr).to.deep.equal({tag: "num", value: 987});
  })

  // TODO: add additional tests here to ensure traverseExpr works as expected
  it('parses an id', () => {
    const source = "a";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);

    expect(parsedExpr).to.deep.equal({tag: "id", name: 'a'});
  })

  it('parses an add binop', () => {
    const source = "123+456";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    expect(parsedExpr).to.deep.equal({tag: "binop", left: {tag: "num", value: 123}, op: "+", right: {tag: "num", value: 456}});
  })

  it('parses a negative number', () => {
    const source = "-7";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    expect(parsedExpr).to.deep.equal({tag: "uniop", op: "-", value: {tag: "num", value: 7}});
  })

  it('pemdas', async() => {
    const source = "1+2*3";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    expect(parsedExpr).to.deep.equal({tag: "binop", left: {tag: "num", value: 1}, op: "+", right: {tag: "binop", left: {tag: "num", value: 2}, op: "*", right: {tag: "num", value: 3}}});
  });

  it('parses a function call with no args', async() => {
    const source = "foo()";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    expect(parsedExpr).to.deep.equal({tag: "call", name: "foo", args: []});
  });

  it('parses a function call with multiple args', async() => {
    const source = "bar(5 + 4, 3, 6)";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();
    cursor.firstChild();

    const parsedExpr = traverseExpr(cursor, source);
    expect(parsedExpr).to.deep.equal({tag: "call", name: "bar", args: [{tag: "binop", op: "+", left: {tag: "num", value: 5}, right: {tag: "num", value: 4}},
                                                                       {tag: "num", value: 3},
                                                                       {tag: "num", value: 6}]});
  });
});

describe('traverseStmt(c, s) function', () => {
  it('parses a single init', () => {
    const source = "x:int=7";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "init", name: 'x', type: "int", value: {tag: "num", value: 7}});
  })

  it('parses a uniop init', () => {
    const source = "x:int=-7";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "init", name: 'x', type: "int", value: {tag: "uniop", op: "-", value: {tag: "num", value: 7}}});
  })

  it('parses a uniop bool', () => {
    const source = "x:bool=not True";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "init", name: 'x', type: "bool", value: {tag: "uniop", op: "not", value: {tag: "bool", value: true}}});
  })

  it('parses a binop assign', () => {
    const source = "x=6-7";
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "assign", name: 'x', value: {tag: "binop", op: "-", left: {tag: "num", value: 6}, right: {tag: "num", value: 7}}});
  })

  it('parses an if', () => {
    const source = 
    `
    if x == 6:
      x = 7
      y = 8
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "if", ifcond: {tag: "binop", op: "==", left: {tag: "id", name: "x"}, right: {tag: "num", value: 6}}
                                               , if: [{tag: "assign", name: "x", value: {tag: "num", value: 7}},
                                                      {tag: "assign", name: "y", value: {tag: "num", value: 8}}]
                                               , elifcond: undefined
                                               , elif: []
                                               , else: []
                                     });
  })

  it('parses an elif', () => {
    const source = 
    `
    if True:
      x = 7
    elif False:
      y = 8
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "if", ifcond: {tag: "bool", value: true}
                                               , if: [{tag: "assign", name: "x", value: {tag: "num", value: 7}}]
                                               , elifcond: {tag: "bool", value: false}
                                               , elif: [{tag: "assign", name: "y", value: {tag: "num", value: 8}}]
                                               , else: []
                                     });
  })

  it('if elif else', () => {
    const source = 
    `
    if True:
      x = 7
    elif False:
      y = 8
    else:
      z = 9
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "if", ifcond: {tag: "bool", value: true}
                                               , if: [{tag: "assign", name: "x", value: {tag: "num", value: 7}}]
                                               , elifcond: {tag: "bool", value: false}
                                               , elif: [{tag: "assign", name: "y", value: {tag: "num", value: 8}}]
                                               , else: [{tag: "assign", name: "z", value: {tag: "num", value: 9}}]
                                     });
  })

  it('parses an else', () => {
    const source = 
    `
    if True:
      x = 7
    else:
      y = 8
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "if", ifcond: {tag: "bool", value: true}
                                               , if: [{tag: "assign", name: "x", value: {tag: "num", value: 7}}]
                                               , elifcond: undefined
                                               , elif: []
                                               , else: [{tag: "assign", name: "y", value: {tag: "num", value: 8}}]
                                     });
  })

  it('parses a while', () => {
    const source = 
    `
    while x == 6:
      x = 1
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "while", 
                                      cond: {tag: "binop", op: "==", left: {tag: "id", name: "x"}, right: {tag: "num", value: 6}},
                                      while: [{tag: "assign", name: "x", value: {tag: "num", value: 1}}]});
  })

  it('parses a func with 2 params and returns an int', () => {
    const source = 
    `
    def foo(x:int, y:bool) -> int:
      return x
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "define",
                                      name: "foo",
                                      params: [{name: "x", type:"int"}, {name: "y", type:"bool"}],
                                      ret: "int",
                                      body: [{tag: "return", expr: {tag: "id", name: "x"}}]
    });
  })

  it('parses a func with 3 params and returns none', () => {
    const source = 
    `
    def baz(x:int, y:bool, z:int):
      return
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "define",
                                      name: "baz",
                                      params: [{name: "x", type:"int"}, {name: "y", type:"bool"}, {name: "z", type:"int"}],
                                      ret: "<None>",
                                      body: [{tag: "return", expr: {tag: "none"}}]
    });
  })

  it('parses a func with 0 params and returns none', () => {
    const source = 
    `
    def bar():
      return
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "define",
                                      name: "bar",
                                      params: [],
                                      ret: "<None>",
                                      body: [{tag: "return", expr: {tag: "none"}}]
    });
  })

  it('parses a return statement with a function call', () => {
    const source =
    `
    return x * fact(x-1)
    `
    const cursor = parser.parse(source).cursor();
    cursor.firstChild();

    const parsedStmt = traverseStmt(cursor, source);
    expect(parsedStmt).to.deep.equal({tag: "return", expr: {tag: "binop", op: "*", left: {tag: "id", name: "x"}, 
    right: {tag: "call", 
           name: "fact",
           args: [{tag: "binop", 
                   op: "-", 
                   left: {tag: "id", name: "x"},
                   right: {tag: "num", value: 1}}]}}});
  })
});

describe('traverse(c, s) function', () => {
  // TODO: add tests here to ensure traverse works as expected
  it('parse a number', () => {
    const source = "987";
    const cursor = parser.parse(source).cursor();
    const traversed = traverse(cursor, source);
    expect(traversed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 987}}]);
  });  

  it('parses a two-line script', () => {
    const source = "6\n7";
    const cursor = parser.parse(source).cursor();
    const traversed = traverse(cursor, source);
    expect(traversed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 6}}, {tag: "expr", expr: {tag: "num", value: 7}}]);
  })
});

describe('parse(source) function', () => {
  it('parse a number', () => {
    const parsed = parse("987");
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 987}}]);
  });  

  it('parses a two-line script', () => {
    const parsed = parse("6\n7");
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 6}}, {tag: "expr", expr: {tag: "num", value: 7}}]);
  })

  it('assign and change based on condition', () => {
    const source = 
    `
    x:int=8
    if x == 8:
      x = 10
    x
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "init", name: 'x', type: "int", value: {tag: "num", value: 8}},
                                  {tag: "if", ifcond: {tag: "binop", op: "==", left: {tag: "id", name: "x"}, right: {tag: "num", value: 8}}
                                               , if: [{tag: "assign", name: "x", value: {tag: "num", value: 10}}]
                                               , elifcond: undefined
                                               , elif: []
                                               , else: []
                                  },
                                  {tag: "expr", expr: {tag: "id", name: "x"}}]);
  })

  it('recursive function', () => {
    const source = 
    `
    def fact(x:int) -> int:
      if x == 0:
        return 1
      else:
        return x * fact(x-1)
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "define", name: "fact", params: [{name: "x", type: "int"}], ret: "int", body: 
                                 [{tag: "if", ifcond: {tag: "binop", op: "==", left: {tag: "id", name: "x"}, right: {tag: "num", value: 0}}, 
                                              if: [{tag: "return", expr: {tag: "num", value: 1}}], 
                                              elifcond: undefined, 
                                              elif: [],  
                                              else: [{tag: "return", expr: {tag: "binop", op: "*", left: {tag: "id", name: "x"}, 
                                                                                                   right: {tag: "call", 
                                                                                                          name: "fact",
                                                                                                          args: [{tag: "binop", 
                                                                                                                  op: "-", 
                                                                                                                  left: {tag: "id", name: "x"},
                                                                                                                  right: {tag: "num", value: 1}}]}}}]}]}]);
  })

  it('2 exprs', () => {
    const source = 
    `
    5
    6
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "expr", expr: {tag: "num", value: 5}},
                                  {tag: "expr", expr: {tag: "num", value: 6}}]);
  })

  it('def foo (no returns) and call foo', () => {
    const source = 
    `
    def foo():
      5
    foo()
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "define",
                                      name: "foo",
                                      params: [],
                                      ret: "<None>",
                                      body: [{tag: "expr", expr: {tag: "num", value: 5}}]},
                                  {tag: "expr", expr: {tag: "call", name: "foo", args: []}}
                                  ]);
  })

  it('def foo (returns) and call foo', () => {
    const source = 
    `
    def foo() -> int:
      return 5
    foo()
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "define",
                                      name: "foo",
                                      params: [],
                                      ret: "int",
                                      body: [{tag: "return", expr: {tag: "num", value: 5}}]},
                                  {tag: "expr", expr: {tag: "call", name: "foo", args: []}}
                                  ]);
  })

  it('variable reassign', () => {
    const source =
    `
    x:int = 5
    x = 7
    x
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "init", name: "x", type: "int", value: {tag: "num", value: 5}},
                                  {tag: "assign", name: "x", value: {tag: "num", value: 7}},
                                  {tag: "expr", expr: {tag: "id", name: "x"}}]);
  })

  it('parse 2 functions', () => {
    const source =
    `
    def foo():
      5
    def bar():
      6
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "define",
                                      name: "foo",
                                      params: [],
                                      ret: "<None>",
                                      body: [{tag: "expr", expr: {tag: "num", value: 5}}]},
                                    {tag: "define",
                                      name: "bar",
                                      params: [],
                                      ret: "<None>",
                                      body: [{tag: "expr", expr: {tag: "num", value: 6}}]}
                                  ]);
  })

  it('while fact 2', () => {
    const source =
    `
    n:int = 5
    x:int = 1
    def mul(a:int, b:int) -> int:
      return a * b
    while n > 0:
      x = mul(x, n)
      n = n - 1
    x
    `
    const parsed = parse(source);
    expect(parsed).to.deep.equal([{tag: "init", name: "n", type: "int", value: {tag: "num", value: 5}},
                                  {tag: "init", name: "x", type: "int", value: {tag: "num", value: 1}},
                                  {tag: "define",
                                    name: "mul",
                                    params: [{name: "a", type: "int"}, {name: "b", type: "int"}],
                                    ret: "int",
                                    body: [{tag: "return", expr: {tag: "binop", op: "*", left: {tag: "id", name: "a"}, right: {tag: "id", name: "b"}}}]},
                                  {tag: "while",
                                    cond: {tag: "binop", op: ">", left: {tag: "id", name: "n"}, right: {tag: "num", value: 0}},
                                    while: [{tag: "assign", name: "x", value: {tag: "call", name: "mul", args: [{tag: "id", name: "x"}, {tag: "id", name: "n"}]}},
                                            {tag: "assign", name: "n", value: {tag: "binop", op: "-", left: {tag: "id", name: "n"}, right: {tag: "num", value: 1}}}]},
                                  {tag: "expr", expr: {tag: "id", name: "x"}}
                                  ]);
  })
});