import { expect, test } from "@playwright/test";
import { POST as submitApplication } from "../api/apply";

const coursePaths = ["acting", "speech", "improv", "custom"];
const courseSignupUrl = "/apply/";
const courseAvailability = {
  acting: "Осталось 5 мест",
  speech: "Осталось 4 места",
  improv: "Осталось 6 мест",
};

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

test("the application form completes its three-step flow", async ({ page }) => {
  let submission: Record<string, unknown> | undefined;
  await page.route("**/api/apply", async (route) => {
    submission = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/apply/");
  await expect(page).toHaveTitle(/Записаться на курс/);
  await expect(page.locator(".apply-brand-header")).not.toContainText(
    "Актёрская Барселона",
  );
  await expect(page.locator(".apply-brand-logo")).toBeVisible();
  await expect(page.locator("#apply-name")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await expect(
    page.getByRole("heading", { name: "Как вас зовут?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "На какой курс вы хотите пойти?" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Контакт для связи" }),
  ).toBeHidden();

  await page.getByLabel("Как вас зовут?").fill("Полина");
  await page.getByRole("button", { name: /продолжить/i }).click();
  await expect(
    page.getByRole("heading", { name: "На какой курс вы хотите пойти?" }),
  ).toBeVisible();
  await page
    .locator(".apply-course-option")
    .filter({ hasText: "Курс актёрского мастерства" })
    .click();
  await expect(page.getByLabel("Курс актёрского мастерства")).toBeChecked();
  await page.getByRole("button", { name: /продолжить/i }).click();
  await page.getByLabel("Telegram или номер телефона").fill("@polina");
  await page.getByRole("button", { name: /отправить заявку/i }).click();

  await expect(
    page.getByRole("heading", { name: "Спасибо, что оставили заявку" }),
  ).toBeVisible();
  expect(submission).toMatchObject({
    name: "Полина",
    course: "Курс актёрского мастерства",
    contact: "@polina",
    consent: true,
  });
});

test("the application form stays aligned in a compact desktop viewport", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Compact desktop layout contract",
  );

  await page.setViewportSize({ width: 1204, height: 677 });
  await page.goto("/apply/");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByText("Шаг 1 из 3", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);

  await page.getByLabel("Как вас зовут?").fill("Полина");
  await page.getByRole("button", { name: /продолжить/i }).click();

  const courseLayout = await page.evaluate(() => {
    const heading = document.querySelector<HTMLElement>(
      ".apply-prompt-panel h1",
    );
    const panel = document.querySelector<HTMLElement>(".apply-course-panel");
    const headingBox = heading?.getBoundingClientRect();
    return {
      headingTop: headingBox?.top ?? -1,
      headingBottom: headingBox?.bottom ?? Number.POSITIVE_INFINITY,
      panelFits: (panel?.scrollWidth ?? 1) <= (panel?.clientWidth ?? 0),
      pageFits: document.documentElement.scrollHeight <= window.innerHeight,
    };
  });
  expect(courseLayout.headingTop).toBeGreaterThanOrEqual(0);
  expect(courseLayout.headingBottom).toBeLessThanOrEqual(677);
  expect(courseLayout.panelFits).toBe(true);
  expect(courseLayout.pageFits).toBe(true);

  await page
    .locator(".apply-course-option")
    .filter({ hasText: "Курс актёрского мастерства" })
    .click();
  await page.getByRole("button", { name: /продолжить/i }).click();

  const contactLayout = await page
    .locator("#apply-contact")
    .evaluate((input) => {
      const contactInput = input as HTMLInputElement;
      const style = getComputedStyle(input);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (context) context.font = style.font;
      return {
        placeholderWidth:
          context?.measureText(contactInput.placeholder).width ?? 0,
        inputWidth: contactInput.clientWidth,
        pageFits: document.documentElement.scrollHeight <= window.innerHeight,
      };
    });
  expect(contactLayout.placeholderWidth).toBeLessThanOrEqual(
    contactLayout.inputWidth,
  );
  expect(contactLayout.pageFits).toBe(true);
});

test("the application API rejects invalid submissions", async () => {
  const response = await submitApplication(
    new Request("https://actingbcn.com/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A",
        course: "Несуществующий курс",
        contact: "1",
        consent: false,
      }),
    }),
  );

  expect(response.status).toBe(400);
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

for (const [course, availability] of Object.entries(courseAvailability)) {
  test(`${course} course page shows remaining availability`, async ({
    page,
  }) => {
    await page.goto(`/courses/${course}/`);
    const availabilityNotice = page.locator(
      ".course-facts .course-availability",
    );
    const signupButton = page.locator(".course-facts .button-dark");

    await expect(availabilityNotice).toHaveText(availability);
    await expect(
      page.locator(".detail-title .course-availability"),
    ).toHaveCount(0);
    await expect(availabilityNotice.locator("span")).toHaveCount(0);
    const noticeStyle = await availabilityNotice.evaluate((notice) => {
      const style = getComputedStyle(notice);
      return {
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        textTransform: style.textTransform,
      };
    });
    const buttonStyle = await signupButton.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        textTransform: style.textTransform,
      };
    });
    expect(noticeStyle).toEqual(buttonStyle);
  });
}

test("custom event page does not show course availability", async ({
  page,
}) => {
  await page.goto("/courses/custom/");
  await expect(page.locator(".course-availability")).toHaveCount(0);
});

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
