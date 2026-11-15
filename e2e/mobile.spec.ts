import {test,expect,login,openAction} from "./fixtures";
test("согласия: регистрация, прежний аккаунт и отзыв",async({page,qa})=>{
  await page.goto("/register");
  for(const name of ["processingConsent","transferConsent"]){
    const box=page.locator(`input[name="${name}"]`); await expect(box).not.toBeChecked(); await expect(box).toHaveAttribute("required","");
  }
  await page.goto("/privacy"); await expect(page.locator("h1")).toHaveText("Политика конфиденциальности");
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await login(page,qa.other); await page.goto("/settings?section=privacy");
  await expect(page.getByText("Для этого аккаунта подтверждение ещё не записано.",{exact:false})).toBeVisible();
  await page.locator('[name="processingConsent"]').check(); await page.locator('[name="transferConsent"]').check();
  await page.getByRole("button",{name:"Подтвердить",exact:true}).click();
  await expect(page.getByText("Подтверждена версия",{exact:false})).toBeVisible();
  const proof=await qa.db.query("select consent_snapshot from users where id=$1",[qa.other.id]); expect(proof.rows[0].consent_snapshot).toContain("alwaysdata");
  await page.getByRole("button",{name:"Отозвать согласие",exact:true}).click();
  await page.locator('[name="confirmWithdrawal"]').check();
  await page.getByRole("button",{name:"Отозвать согласие и удалить аккаунт",exact:true}).click();
  await expect(page).toHaveURL(/\/privacy\?withdrawn=1$/);
  expect((await qa.db.query("select id from users where id=$1",[qa.other.id])).rowCount).toBe(0);
  expect((await qa.db.query("select id from users where id=$1",[qa.owner.id])).rowCount).toBe(1);
  await page.goto("/profile"); await expect(page).toHaveURL(/\/login/);
});
test("мобильный интерфейс: пять вкладок, панели, настройки и PWA",async({page,context,qa},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await login(page,qa.owner);
  await expect(page.locator(".site-navigation a")).toHaveCount(5);
  const paths=["/","/catalog","/library","/community","/profile","/settings","/collections","/stats","/notifications","/admin"];
  for(const path of paths){
    await page.goto(path);await expect(page.locator("main")).toBeVisible();await expect(page.locator('.site-navigation a[aria-current="page"]')).toHaveCount(1);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),{message:path+" must fit the phone"}).toBe(true);
    if(["/","/catalog","/library","/community","/profile"].includes(path))expect(await page.locator("main form:visible").count()).toBeLessThanOrEqual(1);
    if(["/","/catalog"].includes(path)){const image=page.locator("main .poster img:visible").first();if(await image.count())await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:40000}).toBe(true);}
    if(["/","/catalog","/profile","/settings"].includes(path))await page.screenshot({path:testInfo.outputPath("mobile-"+(path.slice(1)||"home")+".png"),caret:"initial"});
  }
  await page.goto("/catalog");const filters=page.getByRole("button",{name:"Фильтры",exact:true});await filters.click();
  await expect(page.getByRole("dialog",{name:"Фильтры",exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("mobile-filters.png"),caret:"initial"});
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).not.toBeVisible();await expect(filters).toBeFocused();
  await page.goto("/catalog/movie/157336");await expect(page.locator(".media-toolbar:visible")).toBeVisible();await expect(page.locator("main form:visible")).toHaveCount(0);
  await expect.poll(()=>page.locator(".media-detail .poster img:visible").evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:40000}).toBe(true); await page.screenshot({path:testInfo.outputPath("mobile-film.png"),caret:"initial"});
  await openAction(page,"rating-save");await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("dialog").getByRole("button",{name:"Закрыть",exact:true}).click();await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/profile");await page.getByRole("link",{name:"Настройки",exact:true}).click();await page.getByRole("link",{name:"Оформление",exact:true}).click();
  const theme=page.locator('select[aria-label="Тема оформления"]');
  await theme.selectOption("light");await expect(page.locator("html")).toHaveAttribute("data-theme","light");await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.emulateMedia({colorScheme:"light"});await theme.selectOption("system");await expect(page.locator("html")).toHaveAttribute("data-theme","light");await page.emulateMedia({colorScheme:"dark"});await expect(page.locator("html")).toHaveAttribute("data-theme","dark");await theme.selectOption("dark");
  await page.goto("/settings?section=profile");const bio=page.locator('textarea[name="bio"]');await bio.fill("E2E unsaved draft");await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);await expect(bio).toHaveValue("E2E unsaved draft");
  await page.goto("/settings?section=app");await page.evaluate(()=>navigator.serviceWorker.register("/sw.js?qa-update=2",{updateViaCache:"none"}).then(()=>undefined));
  const update=page.getByRole("button",{name:"Доступно обновление",exact:true});await expect(update).toBeVisible();page.once("dialog",dialog=>dialog.dismiss());await update.click();await expect(update).toBeVisible();page.once("dialog",dialog=>dialog.accept());await Promise.all([page.waitForEvent("load"),update.click()]);
  await page.goto("/settings?section=preferences");const prefs=page.locator('form:visible:has(select[name="language"])');
  await prefs.locator("select").selectOption("en");await prefs.getByRole("button").click();await expect(page.locator("html")).toHaveAttribute("lang","en");await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await prefs.locator("select").selectOption("de");await prefs.getByRole("button").click();await expect(page.locator("html")).toHaveAttribute("lang","de");
  await page.goto("/profile");await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);await expect(page.locator("main form:visible")).toHaveCount(0);await page.screenshot({path:testInfo.outputPath("mobile-profile-de.png"),caret:"initial"});
  const cached=await page.evaluate(async()=>{const paths:string[]=[];for(const key of await caches.keys())for(const request of await(await caches.open(key)).keys())paths.push(new URL(request.url).pathname);return paths;});
  expect(cached.sort()).toEqual(["/offline.html","/icons/icon-192.png","/icons/icon-512.png","/icons/maskable-512.png"].sort());
  await context.setOffline(true);await page.goto("/library");await expect(page.locator("body")).toContainText(/offline/i);await context.setOffline(false);await page.goto("/profile");expect(errors).toEqual([]);
});
