const allowedCourses = new Set([
  "Курс актёрского мастерства",
  "Курс по речи",
  "Интенсив по импровизации",
]);

declare const process: {
  env: Record<string, string | undefined>;
};

export const maxDuration = 10;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== new URL(request.url).host) {
      return json({ error: "Запрос отклонён" }, 403);
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "Ожидается JSON" }, 415);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "")
      .trim()
      .slice(0, 120);
    const course = String(body.course ?? "").trim();
    const contact = String(body.contact ?? "")
      .trim()
      .slice(0, 180);
    const consent = body.consent === true;
    const website = String(body.website ?? "").trim();

    if (website) return json({ ok: true });

    if (
      name.length < 2 ||
      contact.length < 4 ||
      !allowedCourses.has(course) ||
      !consent
    ) {
      return json({ error: "Проверьте заполненные поля" }, 400);
    }

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    if (!webhookUrl) {
      return json({ error: "Форма ещё не подключена" }, 503);
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        course,
        contact,
        consent,
        source: "Acting BCN website form",
      }),
      signal: AbortSignal.timeout(9_000),
    });

    if (!webhookResponse.ok) throw new Error("Webhook rejected request");

    const webhookBody = await webhookResponse.text();
    if (webhookBody) {
      try {
        const result = JSON.parse(webhookBody) as { ok?: boolean };
        if (result.ok === false) throw new Error("Webhook reported an error");
      } catch (error) {
        if (error instanceof SyntaxError) {
          // Some Google Apps Script deployments return an HTML success page.
        } else {
          throw error;
        }
      }
    }

    return json({ ok: true });
  } catch (error) {
    console.error(
      "Application submission failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return json({ error: "Не удалось отправить заявку" }, 500);
  }
}

export function GET() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}
