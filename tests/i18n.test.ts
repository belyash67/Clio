import {expect,it} from "vitest";
import {dictionary,translate} from "../src/i18n/dictionary";
import {readdir,readFile} from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

it("все помеченные статические строки интерфейса имеют английский и немецкий перевод",async()=>{
  const missing:string[]=[];
  async function scan(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scan(file);else if(file.endsWith(".tsx")){
    const source=ts.createSourceFile(file,await readFile(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node){if(ts.isJsxAttribute(node)&&node.name.getText(source)==="text"&&node.initializer){const initializer=node.initializer;const key=ts.isStringLiteral(initializer)?initializer.text:ts.isJsxExpression(initializer)&&initializer.expression&&ts.isStringLiteral(initializer.expression)?initializer.expression.text:"";if(/[\u0400-\u04ff]/.test(key)&&!dictionary[key]?.every(Boolean))missing.push(`${file}: ${key}`);}ts.forEachChild(node,visit);}visit(source);
  }}}
  await scan("src");expect(missing).toEqual([]);
});
it("переводит интерфейс, сохраняя неизвестные значения и русский оригинал",()=>{
  expect(translate("Библиотека","en")).toBe("Library");expect(translate("Библиотека","de")).toBe("Bibliothek");expect(translate("Библиотека","ru")).toBe("Библиотека");expect(translate("Example user review","en")).toBe("Example user review");expect(translate("Нравится · 2","de")).toBe("Gefällt mir · 2");
});
