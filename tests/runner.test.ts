import { run } from '../runner';
import { expect } from 'chai';
import {emptyEnv} from '../compiler';
import 'mocha';

const importObject = {
  imports: {
    imported_func: (arg : any) => {},
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print_global_func: (pos: number, value: number) => {
      importObject.output += value;
      importObject.output += "\n";
      return value;
    },

    print_int: (value: number) => {
      importObject.output += value;
      importObject.output += "\n";
      return value;
    },

    print_bool: (value: number) => {
      importObject.output += value === 1 ? "True": "False";
      importObject.output += "\n";
      return value;
    },
  },

  output: "",
};

// Clear the output before every test
beforeEach(function () {
  importObject.output = "";
});
  
// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected. 
describe('run(source, config) function', () => {
  const config = {importObject, env: emptyEnv};
  
  // We can test the behavior of the compiler in several ways:
  // 1- we can test the return value of a program
  // Note: since run is an async function, we use await to retrieve the 
  // asynchronous return value. 
  it('returns the right number', async () => {
    const result = await run("987", config);
    expect(result[0]).to.equal(987);
  });

  // 2- we can test the behavior of the compiler by also looking at the log 
  // resulting from running the program
  /*
  it('prints something right', async() => {
    var result = await run("print(1337)", config);
    expect(config.importObject.output).to.equal("1337\n");
  });

  // 3- we can also combine both type of assertions, or feel free to use any 
  // other assertions provided by chai.
  /*
  it('prints two numbers but returns last one', async () => {
    var result = await run("print(987)", config);
    expect(result).to.equal(987);
    result = await run("print(123)", config);
    expect(result).to.equal(123);
    
    expect(config.importObject.output).to.equal("987\n123\n");
  });
  */

  // Note: it is often helpful to write tests for a functionality before you
  // implement it. You will make this test pass!
  it('adds two numbers', async() => {
    const result = await run("2 + 3", config);
    expect(result[0]).to.equal(5);
  });

  it('subtract two numbers to negative', async() => {
    const result = await run("2 - 3", config);
    expect(result[0]).to.equal(-1);
  });

  it('adds variable with number', async() => {
    const result = await run("x:int=5\n2 + x", config);
    expect(result[0]).to.equal(7);
  });

  it('five mul', async() => {
    const result = await run("1*2*3*4*5", config);
    expect(result[0]).to.equal(120);
  });

  it('pemdas', async() => {
    const result = await run("10+20*30", config);
    expect(result[0]).to.equal(610);
  });

  it('not not not true', async() => {
    const result = await run("not not not True", config);
    expect(result[0]).to.equal("False");
  });

  it('int comparison', async() => {
    const result = await run("10 * 100 > 9990 // 10", config);
    expect(result[0]).to.equal("True");
  });

  it('varible reassign', async() => {
    let source =
    `
    x:int=5
    x=7
    x
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(7);
  });

  it('simple if', async() => {
    let source =
    `
    x:int=8
    if x == 8:
      x = 10
    x
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(10);
  });

  it('if elif', async() => {
    let source =
    `
    x:int=9
    if x == 8:
      x = 10
    elif x == 9:
      x = 11
    x
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(11);
  });

  it('if elif else', async() => {
    let source =
    `
    x:int=7
    if x == 8:
      x = 10
    elif x == 9:
      x = 11
    else:
      x = 12
    x
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(12);
  });

  it('nested if', async() => {
    let source =
    `
    x:int=8
    y:int=9
    if x == 8:
      x = 9
      if x == 9:
        y = 10
    x+y
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(19);
  });

  /*
  it('nested if 2', async() => {
    let source =
    `
    x:bool=True
    y:bool=False
    if x == True:
      if y == True:
        1
      else:
        2
    elif x == False:
      if y == True:
        3
      else:
        4
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(2);
  })
  */

  it('while fact', async() => {
    let source =
    `
    n:int=5
    x:int=1
    while n > 0:
      x = x * n
      n = n - 1
    x
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(120);
  })

  it('def foo (0 arg)', async() => {
    let source =
    `
    def foo() -> int:
      return 100
    foo()
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(100);
  })

  it('def add1 (1 arg)', async() => {
    let source =
    `
    def add1(x:int) -> int:
      return x + 1
    add1(5)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(6);
  })

  it('def pick1 (1 arg)', async() => {
    let source =
    `
    def pick1(x:bool) -> int:
      if x == True:
        return 7
      else:
        return 8
    pick1(True)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(7);
  })

  /*
  it('def nested (2 arg)', async() => {
    let source =
    `
    def nested(x:bool, y:bool) -> int:
      if x == True:
        if y == True:
          return 1
        else:
          return 2
      elif x == False:
        if y == True:
          return 3
        else:
          return 4
    nested(True, True) + nested(False, False)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(5);
  })
  */

  it('recursive fact (not real recursion)', async() => {
    let source =
    `
    def fact(x:int) -> int:
      if x == 0:
        return 1
      else:
        return x * fact(x-1)
    fact(0)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(1);
  })

  it('recursive fact (real recursion)', async() => {
    let source =
    `
    def fact(x:int) -> int:
      if x == 0:
        return 1
      else:
        return x * fact(x-1)
    fact(5)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(120);
  })

  it('while fact 2', async() => {
    let source = 
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
    const result = await run(source, config);
    expect(result[0]).to.equal(120);
  })

  /*
  it('bool to int', async() => {
    let source =
    `
    def bool_to_int(b : bool) -> int:
      x:int = 0
      if b:
        x = 1
      return x
    bool_to_int(True)
    `
    const result = await run(source, config);
    expect(result[0]).to.equal(1);
  })
  */

 it('prints something right', async() => {
    var result = await run("print(1337)\nprint(True)", config);
    expect(config.importObject.output).to.equal("1337\nTrue\n");
  });

});