import { expect, test } from "@playwright/test";

const coursePaths = ["acting", "speech", "improv", "custom"];
const courseSignupUrl = "https://acting-bcn-course.cherars.chatgpt.site/";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("the home page exposes every course and a working CTA", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Актерская",
  );
  await expect(page.locator(".course-card")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: /выбрать курс/i }),
  ).toHaveAttribute("href", "#courses");
});

test("the shared logo is present in page headers and footers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".hero-logo")).toHaveCount(0);
  await expect(
    page.locator(".site-footer__logo .brand-logo__mark"),
  ).toBeVisible();

  await page.goto("/courses/acting/");
  await expect(page.locator(".wordmark .brand-logo__mark")).toBeVisible();
  await expect(
    page.locator(".site-footer__logo .brand-logo__mark"),
  ).toBeVisible();
});

test("shared layout guides align major sections", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  const homeLeftEdges = await page
    .locator(".eyebrow, .section-heading, .site-footer__logo")
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().left),
    );
  expect(Math.max(...homeLeftEdges) - Math.min(...homeLeftEdges)).toBeLessThan(
    1,
  );

  await page.goto("/courses/acting/");
  const courseLeftEdges = await page
    .locator(
      ".wordmark, .detail-story, .teachers-heading, .request-content, .site-footer__logo",
    )
    .evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().left),
    );
  expect(
    Math.max(...courseLeftEdges) - Math.min(...courseLeftEdges),
  ).toBeLessThan(1);

  if (testInfo.project.name === "desktop-chromium") {
    await page.goto("/");
    const cardBoxes = await page.locator(".course-card").evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    expect(cardBoxes[2].top - cardBoxes[0].bottom).toBeGreaterThanOrEqual(20);

    await page.goto("/courses/acting/");
    const detailWidths = await page.evaluate(() => ({
      story: document.querySelector(".detail-story")?.getBoundingClientRect()
        .width,
      facts: document.querySelector(".course-facts")?.getBoundingClientRect()
        .width,
      factValue: document
        .querySelector(".course-facts dd")
        ?.getBoundingClientRect().width,
    }));
    expect(
      (detailWidths.facts ?? 0) / (detailWidths.story ?? 1),
    ).toBeGreaterThan(0.75);
    expect(detailWidths.factValue).toBeGreaterThan(180);
  }
});

for (const course of coursePaths) {
  test(`${course} course page renders without horizontal overflow`, async ({
    page,
  }) => {
    await page.goto(`/courses/${course}/`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".course-facts")).toBeVisible();

    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
}

test("course facts keep one shared and aligned layout", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Desktop alignment contract",
  );
  const layouts = [];

  for (const course of ["acting", "speech", "improv"]) {
    await page.goto(`/courses/${course}/`);
    const layout = await page
      .locator(".course-facts__list")
      .evaluate((list) => {
        const listBox = list.getBoundingClientRect();
        const terms = Array.from(list.querySelectorAll("dt"));
        const descriptions = Array.from(list.querySelectorAll("dd"));
        return terms.map((term, index) => {
          const termBox = term.getBoundingClientRect();
          const descriptionBox = descriptions[index].getBoundingClientRect();
          return {
            termTop: termBox.top,
            descriptionTop: descriptionBox.top,
            termLeft: termBox.left - listBox.left,
            termRight: termBox.right - listBox.left,
            descriptionLeft: descriptionBox.left - listBox.left,
            termFits: term.scrollWidth <= term.clientWidth,
            whiteSpace: getComputedStyle(term).whiteSpace,
          };
        });
      });
    layouts.push(layout);
  }

  for (const rows of layouts) {
    for (const row of rows) {
      expect(Math.abs(row.termTop - row.descriptionTop)).toBeLessThan(1);
      expect(row.descriptionLeft - row.termRight).toBeGreaterThanOrEqual(8);
    }
    expect(rows[1].termFits).toBe(true);
    expect(rows[1].whiteSpace).toBe("nowrap");
  }

  expect(layouts[1][0].descriptionLeft).toBeCloseTo(
    layouts[0][0].descriptionLeft,
    0,
  );
  expect(layouts[2][0].descriptionLeft).toBeCloseTo(
    layouts[0][0].descriptionLeft,
    0,
  );
});

test("navigation and application controls meet the mobile touch target", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Mobile interaction contract",
  );
  await page.goto("/courses/improv/");

  for (const locator of [
    page.locator(".wordmark"),
    page.locator(".back-link"),
  ]) {
    const box = await locator.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await expect(page.locator(".teacher-card img")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Присоединиться к курсу" }),
  ).toHaveAttribute("href", courseSignupUrl);
});

for (const course of coursePaths) {
  test(`${course} uses the shared signup and request CTA`, async ({ page }) => {
    await page.goto(`/courses/${course}/`);

    const factsCta = page.getByRole("link", { name: "Выбрать этот курс" });
    await expect(factsCta).toHaveAttribute("href", courseSignupUrl);
    await expect(factsCta.locator("span")).toHaveCount(0);

    const request = page.locator(".request-section");
    await expect(request.locator(".section-index")).toHaveCount(0);
    await expect(request).toContainText(
      "Оставьте заявку. Мы напишем вам с подробностями и поможем забронировать место.",
    );
    await expect(
      request.getByRole("link", { name: "Присоединиться к курсу" }),
    ).toHaveAttribute("href", courseSignupUrl);
    await expect(
      request.getByRole("link", { name: "Вернуться к курсам" }),
    ).toHaveAttribute("href", "/#courses");
  });
}

test("request CTA uses the shared on-brand variant and follows its column", async ({
  page,
}) => {
  await page.goto("/courses/acting/");

  const actions = page.locator(".request-actions");
  const requestCta = actions.getByRole("link", {
    name: "Присоединиться к курсу",
  });

  await expect(requestCta).toHaveClass(/\bbutton-on-brand\b/);
  await expect(requestCta).toHaveCSS("background-color", "rgb(251, 243, 160)");
  await expect(requestCta).toHaveCSS("color", "rgb(220, 94, 53)");
  await expect(requestCta).toHaveCSS("border-color", "rgb(251, 243, 160)");

  const [actionsBox, ctaBox] = await Promise.all([
    actions.boundingBox(),
    requestCta.boundingBox(),
  ]);
  expect(Math.abs((actionsBox?.x ?? 0) - (ctaBox?.x ?? 0))).toBeLessThan(1);
  expect(
    Math.abs((actionsBox?.width ?? 0) - (ctaBox?.width ?? 0)),
  ).toBeLessThan(1);

  await requestCta.hover();
  await expect(requestCta).toHaveCSS("background-color", "rgb(220, 94, 53)");
  await expect(requestCta).toHaveCSS("color", "rgb(251, 243, 160)");
  await expect(requestCta).toHaveCSS("border-color", "rgb(251, 243, 160)");
});

test("updated course copy is rendered without expired offers", async ({
  page,
}) => {
  await page.goto("/courses/acting/");
  await expect(
    page.getByText("Основные блоки курса", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".course-offer")).toHaveCount(0);

  await page.goto("/courses/speech/");
  await expect(page.locator(".course-offer")).toHaveCount(0);

  await page.goto("/courses/custom/");
  await expect(page.locator(".detail-story")).toContainText(
    "Это может быть тренинг по раскрепощению или импровизации, практика публичных выступлений, занятие по речи или развлекательная программа — для корпоративного или частного мероприятия.",
  );

  await page.goto("/");
  await expect(page.locator(".site-footer")).toContainText(
    "Театр начинается с вас",
  );
});

test("course facts produce a reviewable visual artifact", async ({
  page,
}, testInfo) => {
  await page.goto("/courses/acting/");
  await page.evaluate(() => document.fonts.ready);
  const screenshot = await page.locator(".course-facts").screenshot({
    animations: "disabled",
  });
  await testInfo.attach("course-facts", {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(1_000);
});
