import { test as base, expect, type Page, type Locator } from "@playwright/test";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

export type QaUser = { id: string; username: string; email: string; password: string };
export type Qa = { owner: QaUser; friend: QaUser; other: QaUser; db: Client };

export const test = base.extend<{ qa: Qa }>({
  qa: async ({ baseURL }, provide) => {
    if (baseURL !== process.env.CLIO_E2E_URL) throw new Error("Unexpected test application URL");
    if (!/^clio_e2e_[a-f0-9]{32}$/.test(process.env.CLIO_E2E_SCHEMA ?? "")) throw new Error("Use npm run test:e2e; live DB fixtures are forbidden");
    const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
    const current = await db.query("select current_schema() as schema");
    if (current.rows[0].schema !== process.env.CLIO_E2E_SCHEMA) throw new Error("Unsafe test schema");
    // Independent tests share localhost's rate-limit identity, never the live schema.
    await db.query("delete from rate_limits");
    const password = process.env.CLIO_E2E_PASSWORD!; const hash = await hashPassword(password);
    const users: QaUser[] = [];
    for (const kind of ["owner", "friend", "other"]) {
      const username = `qa_${kind}_${randomUUID().slice(0,8)}`;
      const email = `${username}@example.invalid`;
      const row = await db.query("insert into users(name,username,email,email_verified,personal_badge) values($1,$1,$2,true,$3) returning id", [username, email, kind === "owner"]);
      const id = row.rows[0].id;
      await db.query("insert into accounts(user_id,account_id,provider_id,password) values($1,$1,'credential',$2)", [id, hash]);
      await db.query("insert into user_settings(user_id) values($1)", [id]);
      if (kind === "owner") await db.query("insert into user_roles(user_id,role) values($1,'admin')", [id]);
      users.push({ id, username, email, password });
    }
    try { await provide({ owner: users[0], friend: users[1], other: users[2], db }); }
    finally { await db.end(); }
  },
});
export { expect };

export async function login(page: Page, user: QaUser) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}
export function action(page: Page | Locator, op: string) { return page.locator(`form:visible:has(input[name="op"][value="${op}"])`); }
export async function openAction(page:Page,op:string){
  const form=action(page,op);
  if(await form.isVisible())return form;
  if(op==="review-delete")await page.getByRole("button",{name:"Действия с рецензией",exact:true}).click();
  else if(op==="friend-remove")await page.getByRole("button",{name:"Управлять дружбой",exact:true}).click();
  else {
    const labels:Record<string,string>={"library-save":"В библиотеку","rating-save":"Моя оценка","review-save":"Рецензия"};
    if(labels[op])await page.locator(".media-toolbar:visible").getByRole("button",{name:new RegExp("^"+labels[op])}).click();
    else {
      if(!await page.getByRole("dialog",{name:"Ещё",exact:true}).isVisible())await page.locator(".media-toolbar:visible").getByRole("button",{name:"Ещё",exact:true}).click();
      const summaries:Record<string,string>={"watch-add":"Записать просмотр","collection-add":"Добавить в коллекцию","catalog-edit":"Исправить карточку (модератор)"};
      if(!await form.isVisible()&&summaries[op])await page.getByRole("dialog",{name:"Ещё",exact:true}).locator("summary").filter({hasText:summaries[op]}).click();
    }
  }
  await expect(form).toBeVisible();return form;
}
export async function save(form: Locator, label: string) {
  const modal=form.locator("xpath=ancestor::dialog");const inSheet=await modal.count()>0;
  const compact=await form.locator(".compact-action").count()>0;
  const submitted = form.page().waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
  await form.getByRole("button", { name: label, exact: true }).click();
  await (await submitted).finished();
  if(inSheet)await expect(modal).not.toBeVisible();
  else if(compact)await expect(form.locator(".feedback")).toHaveCount(0);
  else await expect(form.getByRole("status")).toContainText("Сохранено.");
}
export async function privacy(page: Page, profile = "public", library = "friends", activity = "friends") {
  await page.goto("/settings?section=profile");
  const form = page.locator("form").filter({ has: page.locator('select[name="profileVisibility"]') });
  await form.locator('[name="profileVisibility"]').selectOption(profile);
  await form.locator('[name="libraryVisibility"]').selectOption(library);
  await form.locator('[name="activityVisibility"]').selectOption(activity);
  await form.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("Изменения сохранены.");
}
