const fs = require("node:fs");
const path = require("node:path");

const DEBUG_PORT = Number(process.env.CDP_PORT || 9227);
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://127.0.0.1:8777/";
const OUT_DIR = path.resolve(__dirname, "..", "outputs", "dashboard");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, retries = 30) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw lastError;
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) || [];
      listeners.forEach((listener) => listener(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        const listeners = this.events.get(method) || [];
        this.events.set(
          method,
          listeners.filter((candidate) => candidate !== listener),
        );
        resolve(params);
      };
      this.events.set(method, [...(this.events.get(method) || []), listener]);
    });
  }

  close() {
    this.ws.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  return result.result.value;
}

async function navigate(client, width, height, mobile) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  const loaded = client.once("Page.loadEventFired");
  await client.send("Page.navigate", { url: DASHBOARD_URL });
  await loaded;
  await sleep(900);
}

async function screenshot(client, name) {
  const image = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  const target = path.join(OUT_DIR, name);
  fs.writeFileSync(target, Buffer.from(image.data, "base64"));
  return target;
}

async function main() {
  const pages = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const page = pages.find((candidate) => candidate.type === "page") || pages[0];
  if (!page) throw new Error("No CDP page target found.");

  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");

  await navigate(client, 1440, 1200, false);
  const desktopBefore = await evaluate(
    client,
    `(() => {
      const overflowNodes = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === "visible")
        .slice(0, 6)
        .map((el) => ({ tag: el.tagName, id: el.id, cls: el.className, text: (el.textContent || "").trim().slice(0, 80) }));
      return {
        title: document.querySelector("h1")?.textContent || "",
        coverage: document.querySelector("#coverageText")?.textContent || "",
        kpiCards: document.querySelectorAll("#kpiGrid .kpi").length,
        levelSvg: !!document.querySelector("#levelChart svg"),
        growthSvg: !!document.querySelector("#growthChart svg"),
        chartPoints: document.querySelectorAll("[data-chart-point][role='button'][tabindex='0']").length,
        tableRows: document.querySelectorAll("#dataTableBody tr").length,
        sourceItems: document.querySelectorAll("#sourceDetails .source-item").length,
        bodyScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        overflowNodes,
      };
    })()`,
  );
  const clickResult = await evaluate(
    client,
    `(() => {
      const point = document.querySelector("#levelChart [data-chart-point]");
      if (!point) return { clicked: false, detail: "" };
      point.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return {
        clicked: true,
        detail: document.querySelector("#levelPointDetail")?.innerText || "",
        selectedPoints: document.querySelectorAll("#levelChart .chart-point.selected").length,
      };
    })()`,
  );
  const desktopScreenshot = await screenshot(client, "dashboard-hs21039011-desktop-smoke.png");

  await navigate(client, 390, 1600, true);
  const mobile = await evaluate(
    client,
    `(() => {
      const overflowNodes = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === "visible")
        .slice(0, 6)
        .map((el) => ({ tag: el.tagName, id: el.id, cls: el.className, text: (el.textContent || "").trim().slice(0, 80) }));
      return {
        title: document.querySelector("h1")?.textContent || "",
        kpiCards: document.querySelectorAll("#kpiGrid .kpi").length,
        chartPoints: document.querySelectorAll("[data-chart-point][role='button'][tabindex='0']").length,
        tableRows: document.querySelectorAll("#dataTableBody tr").length,
        bodyScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        overflowNodes,
      };
    })()`,
  );
  const mobileScreenshot = await screenshot(client, "dashboard-hs21039011-mobile-smoke.png");

  client.close();
  console.log(
    JSON.stringify(
      {
        desktopBefore,
        clickResult,
        mobile,
        screenshots: { desktopScreenshot, mobileScreenshot },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
