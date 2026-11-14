import { test, expect, login, privacy, action, save, openAction } from "./fixtures";

test("два пользователя: библиотека, дневник, дружба, рецензии, коллекции и модерация", async ({ page, browser, qa }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const second = await browser.newContext(); const friend = await second.newPage();
  friend.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept()); friend.on("dialog", dialog => dialog.accept());
  let reviewId = "", collectionId = "";
  const movie = "/catalog/movie/157336", series = "/catalog/tv/70523";
  try {
    await test.step("вход, личная галочка и защита панели", async () => {
      await login(page, qa.owner); await expect(page.locator('[aria-label="Создатель Clio"]')).toBeVisible();
      await page.getByRole("button",{name:"Ещё",exact:true}).click(); await expect(page.getByRole("link", { name: "Модерация", exact: true })).toBeVisible(); await page.getByRole("dialog").getByRole("button",{name:"Закрыть",exact:true}).click();
      await login(friend, qa.friend); await expect(friend.locator(".owner-badge")).toHaveCount(0);
      await friend.goto("/admin"); await expect(friend.getByText("404", { exact: true })).toBeVisible();
      await privacy(page); await privacy(friend);
    });
    await test.step("настоящий каталог, постер, библиотека и история оценок", async () => {
      await page.goto("/catalog?q=Interstellar&type=movie");
      await expect(page.locator(`.media-card[href="${movie}"]`)).toBeVisible();
      await page.locator(`.media-card[href="${movie}"]`).click();
      await expect(page.locator(".media-detail .poster img:visible")).toBeVisible();
      await expect.poll(() => page.locator(".media-detail .poster img:visible").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),{timeout:40000}).toBe(true);
      const library = await openAction(page, "library-save"); await library.locator('[name="status"]').selectOption("later"); await library.locator('[name="favorite"]').check(); await save(library, "Сохранить статус");
      const rating = await openAction(page, "rating-save"); await rating.locator("select").selectOption("17"); await save(rating, "Сохранить оценку");
      await openAction(page,"rating-save"); await rating.locator("select").selectOption("18"); await save(rating, "Сохранить оценку");
      await page.goto("/ratings"); await expect(page.locator(".media-card")).toHaveCount(1); await expect(page.locator(".social-section .social-card")).toHaveCount(2);
      await friend.goto("/library"); await expect(friend.locator(".media-card")).toHaveCount(0);
      await page.goto("/library?favorites=1&sort=rating"); await expect(page.locator(".media-card")).toHaveCount(1);
    });
    await test.step("два просмотра, редактирование и удаление записи", async () => {
      await page.goto(movie); const watch = await openAction(page, "watch-add");
      await watch.locator('[name="watchedOn"]').fill("2020-01-01"); await watch.locator('[name="note"]').fill("E2E first watch"); await save(watch, "Записать просмотр");
      await openAction(page,"watch-add"); await watch.locator('[name="watchedOn"]').fill("2020-02-01"); await watch.locator('[name="note"]').fill("E2E rewatch"); await save(watch, "Записать просмотр");
      await page.goto("/diary"); await expect(page.locator("article.social-card")).toHaveCount(2);
      const card = page.locator("article.social-card").filter({ hasText: "E2E first watch" }); await card.locator("summary").click();
      const watchId = await action(card, "watch-edit").locator('input[name="id"]').inputValue();
      const editWatch = action(page, "watch-edit").filter({ has: page.locator(`input[name="id"][value="${watchId}"]`) });
      await editWatch.locator('[name="note"]').fill("E2E corrected watch"); await save(editWatch, "Сохранить");
      await expect(page.locator("p.user-text").filter({ hasText: "E2E corrected watch" })).toBeVisible();
      await action(page.locator("article.social-card").filter({ hasText: "E2E rewatch" }), "watch-delete").getByRole("button").click();
      await expect(page.locator("article.social-card")).toHaveCount(1);
    });
    await test.step("приватность рецензии до и после дружбы", async () => {
      await page.goto(movie); const form = await openAction(page, "review-save"); await form.locator('[name="body"]').fill("E2E review with spoilers"); await form.locator('[name="spoiler"]').check(); await save(form, "Сохранить рецензию");
      reviewId = (await qa.db.query("select id from reviews where user_id=$1", [qa.owner.id])).rows[0].id;
      await page.getByRole("button",{name:"Действия с рецензией",exact:true}).click();await page.getByRole("link",{name:"Редактировать",exact:true}).click();await expect(page.getByRole("dialog",{name:"Моя рецензия",exact:true})).toBeVisible();await page.getByRole("dialog",{name:"Моя рецензия",exact:true}).getByRole("button",{name:"Закрыть",exact:true}).click();
      await friend.goto(`/reviews/${reviewId}`); await expect(friend.getByText("E2E review with spoilers", { exact: true })).toHaveCount(0);
      await friend.goto(`/users/${qa.owner.username}?tab=library`); await action(friend,"friend-request").getByRole("button",{name:"Добавить в друзья",exact:true}).click(); await expect(friend.getByText("Запрос отправлен",{exact:true})).toBeVisible();
      await page.goto("/community?tab=friends"); await action(page, "friend-accept").getByRole("button", { name: "Принять", exact: true }).click();
      await expect.poll(async () => (await qa.db.query("select status from friendships where low_id=least($1::text,$2::text) and high_id=greatest($1::text,$2::text)", [qa.owner.id,qa.friend.id])).rows[0]?.status).toBe("accepted");
      await friend.goto(`/users/${qa.owner.username}?tab=library`); await expect(friend.locator(".media-card")).toHaveCount(1);
      await friend.goto(`/reviews/${reviewId}`); await expect(friend.getByText("E2E review with spoilers", { exact: true })).toHaveCount(0);
      await page.goto(movie); await openAction(page,"review-save"); await action(page, "review-save").locator('[name="visibility"]').selectOption("friends"); await save(action(page, "review-save"), "Сохранить рецензию");
      await friend.goto(`/reviews/${reviewId}`); await friend.getByText("Рецензия со спойлерами — раскрыть", { exact: true }).click(); await expect(friend.getByText("E2E review with spoilers", { exact: true })).toBeVisible();
      await expect(friend.locator(".owner-badge")).toBeVisible(); await expect(action(friend, "review-delete")).toHaveCount(0);
    });
    await test.step("лайк, комментарий, редактирование, ответ и уведомления", async () => {
      await save(action(friend, "review-like"), "Нравится · 0");
      const comment = action(friend, "comment-add").filter({ hasNot: friend.locator('input[name="parentId"]') }); await comment.locator('[name="body"]').fill("E2E comment"); await save(comment, "Добавить комментарий");
      const card = friend.locator("article.social-card").filter({ has: friend.locator('input[name="op"][value="comment-edit"]') }); await card.getByText("Редактировать комментарий", { exact: true }).click();
      await action(card, "comment-edit").locator('[name="body"]').fill("E2E edited comment"); await save(action(card, "comment-edit"), "Сохранить");
      await page.goto(`/reviews/${reviewId}`); const incoming = page.locator("article.social-card").filter({ hasText: "E2E edited comment" }); await incoming.getByText("Ответить", { exact: true }).first().click();
      await action(incoming, "comment-add").locator('[name="body"]').fill("E2E reply"); await save(action(incoming, "comment-add"), "Ответить");
      await friend.goto("/notifications"); await expect(friend.locator("article.social-card")).not.toHaveCount(0); await save(action(friend, "notifications-read"), "Отметить все прочитанными"); await expect(friend.locator(".unread")).toHaveCount(0);
      await page.goto("/notifications"); await expect(page.locator("article.social-card")).not.toHaveCount(0);
      await friend.goto("/community"); await expect(friend.locator(`a[href="/reviews/${reviewId}"]`)).toBeVisible();
    });
    await test.step("создание, порядок и приватность коллекции", async () => {
      await page.goto("/collections"); await page.locator("summary").filter({ hasText: "Создать коллекцию" }).click(); const create = action(page, "collection-create"); await create.locator('[name="title"]').fill("E2E collection"); await create.locator('[name="public"]').check(); await create.getByRole("button").click();
      await expect(page).toHaveURL(/\/collections\/[a-f0-9-]+$/); collectionId = page.url().split("/").at(-1)!;
      for (const path of [movie, series]) { await page.goto(path); await openAction(page,"collection-add"); await action(page, "collection-add").locator("select").selectOption(collectionId); await save(action(page, "collection-add"), "Добавить в коллекцию"); }
      await page.goto(`/collections/${collectionId}`); await expect(page.locator(".media-card")).toHaveCount(2);await page.getByText("Изменить порядок",{exact:true}).click();
      const before = await page.locator(".media-card").first().getAttribute("href"); await action(page, "collection-move").filter({ has: page.locator('input[name="direction"][value="up"]') }).getByRole("button", { name: "↑ Выше", exact: true }).click();
      await expect(page.locator(".media-card").first()).not.toHaveAttribute("href", before!);
      await friend.goto(`/collections/${collectionId}`); await expect(friend.getByRole("heading", { name: "E2E collection" })).toBeVisible(); await expect(action(friend, "collection-save")).toHaveCount(0);
      await page.getByText("Настройки коллекции", { exact: true }).click(); const edit = action(page, "collection-save"); await edit.locator('[name="public"]').uncheck(); await save(edit, "Сохранить");
      await friend.goto(`/collections/${collectionId}`); await expect(friend.getByRole("heading", { name: "E2E collection" })).toHaveCount(0);
      await action(page,"collection-remove").first().getByRole("button").click(); await expect(page.locator(".media-card")).toHaveCount(1);
      await page.goto(`/collections/${collectionId}`); await page.getByText("Настройки коллекции",{exact:true}).click(); await action(page,"collection-delete").getByRole("button").click();
      await expect(page).toHaveURL(/\/collections$/); await expect(page.getByRole("heading",{name:"E2E collection",exact:true})).toHaveCount(0);
    });
    await test.step("друзья всегда открывают профиль, отдельная приватность скрывает контент", async () => {
      await page.goto("/stats"); await expect(page.getByRole("heading", { name: "Моё кино в цифрах" })).toBeVisible(); await expect(page.locator(".stat-grid .stat-value")).toHaveText(["1", "0", "1", "1", "9.0", "1"]);
      await privacy(page, "friends", "private", "private");
      await expect(page.locator('select[name="profileVisibility"] option')).toHaveText(["Друзья","Все"]);
      await friend.goto("/community?tab=friends");await friend.getByRole("link",{name:qa.owner.username,exact:true}).click();await expect(friend.locator(".identity")).toContainText(qa.owner.username);
      await friend.locator(".section-tabs").getByRole("link",{name:"Библиотека",exact:true}).click();await expect(friend.locator(".media-card")).toHaveCount(0);
      await friend.goto(`/reviews/${reviewId}`);await expect(friend.locator("article.review-full")).toHaveCount(1);
      await friend.goto("/community"); await expect(friend.locator(`a[href="/reviews/${reviewId}"]`)).toHaveCount(0); await privacy(page);
    });
    await test.step("жалоба, скрытие, восстановление, блокировка и разблокировка", async () => {
      await friend.goto(series); const review = await openAction(friend, "review-save"); await review.locator('[name="body"]').fill("E2E moderation target"); await review.locator('[name="visibility"]').selectOption("public"); await save(review, "Сохранить рецензию");
      const rid = (await qa.db.query("select id from reviews where user_id=$1", [qa.friend.id])).rows[0].id;
      await page.goto(`/reviews/${rid}`); await page.getByText("Пожаловаться на рецензию", { exact: true }).click(); await action(page, "report-create").locator('[name="reason"]').fill("E2E moderation report"); await save(action(page, "report-create"), "Отправить");
      for (const decision of ["hide", "restore", "block", "unblock"]) {
        await page.goto(`/admin?resolved=${decision === "hide" ? "0" : "1"}`);
        const report = page.locator("article.social-card").filter({ hasText: "E2E moderation report" });
        await action(report, "moderate").locator("select").selectOption(decision); await action(report, "moderate").getByRole("button").click();
        await expect.poll(async () => decision === "hide" || decision === "restore" ? (await qa.db.query("select hidden from reviews where id=$1", [rid])).rows[0].hidden : Boolean((await qa.db.query("select blocked_at from users where id=$1", [qa.friend.id])).rows[0].blocked_at)).toBe(decision === "hide" || decision === "block");
        if (decision === "hide") { await friend.goto(`/reviews/${rid}`); await expect(friend.getByText("E2E moderation target", { exact: true })).toHaveCount(0); }
        if (decision === "block") { await friend.goto("/profile"); await expect(friend).toHaveURL(/\/login/); }
      }
      await login(friend, qa.friend);
      await page.screenshot({ path: testInfo.outputPath("desktop-admin.png"), fullPage: true, caret: "initial" });
    });
    await test.step("правки каталога доступны администратору и сохраняются",async()=>{
      await page.goto(movie); await openAction(page,"catalog-edit");
      const edit=action(page,"catalog-edit"); await edit.locator('[name="titleOverride"]').fill("E2E corrected title"); await edit.locator("select").selectOption("anime"); await save(edit,"Сохранить");
      await expect(page.getByRole("heading",{name:"E2E corrected title",exact:true,level:1})).toBeVisible();
      await page.reload(); await expect(page.getByRole("heading",{name:"E2E corrected title",exact:true,level:1})).toBeVisible();
      await openAction(page,"catalog-edit"); await edit.locator('[name="titleOverride"]').fill(""); await edit.locator("select").selectOption(""); await save(edit,"Сохранить");
      await expect(page.getByRole("heading",{name:"E2E corrected title",exact:true,level:1})).toHaveCount(0);
    });
    await test.step("отключение уведомлений, удаление комментария, дружбы, рецензии и библиотеки",async()=>{
      await friend.goto("/settings?section=preferences"); const preferences=friend.locator('form:visible:has(select[name="language"])'); await preferences.locator('[name="notificationsEnabled"]').uncheck();
      await Promise.all([friend.waitForEvent("load"),preferences.getByRole("button").click()]);
      await expect(friend.locator('[name="notificationsEnabled"]')).not.toBeChecked();
      const before=(await qa.db.query("select count(*)::int as count from notifications where user_id=$1",[qa.friend.id])).rows[0].count;
      await page.goto(`/reviews/${reviewId}`); const parent=page.locator("article.social-card").filter({hasText:"E2E edited comment"}); await parent.getByText("Ответить",{exact:true}).first().click();
      await action(parent,"comment-add").locator('[name="body"]').fill("E2E muted reply"); await save(action(parent,"comment-add"),"Ответить");
      expect((await qa.db.query("select count(*)::int as count from notifications where user_id=$1",[qa.friend.id])).rows[0].count).toBe(before);
      await friend.goto(`/reviews/${reviewId}`); await action(friend,"comment-delete").getByRole("button").click(); await expect(friend.locator("p.user-text").filter({hasText:"E2E edited comment"})).toHaveCount(0);
      await page.goto("/community?tab=friends"); await openAction(page,"friend-remove"); await action(page,"friend-remove").getByRole("button",{name:"Удалить из друзей",exact:true}).click();
      await expect.poll(async()=>(await qa.db.query("select count(*)::int as count from friendships")).rows[0].count).toBe(0);
      await friend.goto(`/users/${qa.owner.username}?tab=library`); await expect(friend.locator(".media-card")).toHaveCount(0);
      await friend.goto(`/reviews/${reviewId}`); await expect(friend.getByText("E2E review with spoilers",{exact:true})).toHaveCount(0);
      await page.goto(`/reviews/${reviewId}`); await openAction(page,"review-delete"); await action(page,"review-delete").getByRole("button").click(); await expect(page).toHaveURL(new RegExp(movie+"$")); await expect.poll(async()=>(await qa.db.query("select id from reviews where id=$1",[reviewId])).rowCount).toBe(0);
      await page.goto(movie); await openAction(page,"library-delete"); await action(page,"library-delete").getByRole("button").click(); await expect(action(page,"library-delete")).toHaveCount(0); await page.goto("/library"); await expect(page.locator(".media-card")).toHaveCount(0);
    });
    expect(errors).toEqual([]);
  } finally { await second.close(); }
});

test("каталог: фильтры, сериалы, люди, аниме и валидация регистрации", async ({ page }, testInfo) => {
  let transientFailure=false;
  await page.route("**/api/posters/**",async route=>{if(!transientFailure){transientFailure=true;await route.fulfill({status:502,headers:{"Cache-Control":"no-store"},body:""});}else await route.continue();});
  await page.goto("/catalog?type=movie&year=2020&genre=18&country=US&minRating=7&sort=vote_average.desc");
  await expect(page.locator(".media-card").first()).toBeVisible();
  for (const text of await page.locator(".media-card p").allTextContents()) expect(text).toContain("2020");
  for (const card of await page.locator(".media-card").all()) {
    await card.scrollIntoViewIfNeeded();
    const image=card.locator("img");
    if(await image.count()) await expect.poll(()=>image.evaluate((img: HTMLImageElement)=>img.complete&&img.naturalWidth>0),{timeout:40000}).toBe(true);
  }
  expect(transientFailure).toBe(true);
  await expect(page.getByText("Постер недоступен", {exact:true})).toHaveCount(0);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({ path: testInfo.outputPath("desktop-catalog.png"), fullPage: true, caret: "initial" });
  await page.goto("/catalog?q=Dark&type=tv"); await expect(page.locator('.media-card[href="/catalog/tv/70523"]')).toBeVisible();
  await expect(page.locator('select[name="genre"]')).toBeDisabled();
  await page.goto("/catalog?mode=person&q=Nolan&type=movie");
  await page.locator(".people-list a").filter({ hasText: /Nolan|Нолан/ }).first().click(); await expect(page).toHaveURL(/\/people\//); await expect(page.locator(".media-card").first()).toBeVisible();
  await page.goto("/catalog?type=movie&animation=anime"); await expect(page.locator(".media-card").first()).toBeVisible();
  await page.goto("/register"); await page.locator('[name="name"]').fill("QA validation"); await page.locator('[name="username"]').fill("qa_validation"); await page.locator('[name="email"]').fill("qa_validation@example.invalid");
  await page.locator('[name="password"]').fill("qa-password-one"); await page.locator('[name="confirmPassword"]').fill("qa-password-two"); await page.getByRole("button", { name: "Создать аккаунт", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Пароли не совпадают.");
});

test("сессии, смена пароля, username и удаление только тестового аккаунта", async ({ page, browser, qa }) => {
  await login(page, qa.other); const second = await browser.newContext(); const other = await second.newPage();
  try {
    await login(other, qa.other);
    await page.goto("/settings?section=security");
    await page.getByRole("button", { name: "Выйти на остальных устройствах", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Все остальные сессии завершены.");
    await other.goto("/profile"); await expect(other).toHaveURL(/\/login/);
    const newPassword = `${qa.other.password}-new`;
    const password = page.locator('form:has(input[name="newPassword"])');
    await password.locator('[name="currentPassword"]').fill(qa.other.password); await password.locator('[name="newPassword"]').fill(newPassword); await password.locator('[name="confirmation"]').fill(newPassword); await password.getByRole("button").click();
    await expect(page.getByRole("status")).toContainText("Пароль изменён");
    await login(other, { ...qa.other, password: newPassword }); await other.goto("/settings?section=username");
    await other.locator('form:has(input[name="username"]) input[name="username"]').fill(`${qa.other.username}_x`);
    await other.getByRole("button", { name: "Изменить username", exact: true }).click(); await expect(other.getByRole("status")).toContainText("Username изменён."); await other.reload();
    await other.goto("/profile"); await expect(other.locator(".identity")).toContainText(`${qa.other.username}_x`); await expect(other.locator(".owner-badge")).toHaveCount(0);
    await other.goto("/settings?section=delete"); const deletion = other.locator('form:has(input[name="confirmation"][pattern="DELETE"])'); await deletion.locator('[name="password"]').fill(newPassword); await deletion.locator('[name="confirmation"]').fill("DELETE"); await deletion.getByRole("button").click();
    await expect(other).toHaveURL(process.env.CLIO_E2E_URL+"/");
    expect((await qa.db.query("select id from users where id=$1", [qa.other.id])).rowCount).toBe(0);
  } finally { await second.close(); }
});
