// Settings → Chat → OmniRoute: turn it on, see where it stands and fix what is
// missing, one step at a time — install it (from its official source, by the
// user), start it (Coucou does), give it a key, pick a model. The router itself
// lives in omniroute.rs; this card only asks it and shows the answer.

import { Bridge } from "../core/bridge";
import {
  DEFAULT_URL, INSTALL_COMMAND, OmniRouteBridge, REPO_URL, SITE_URL, featuresModel, omnirouteConfig, stage,
  type OmniRouteConfig, type OmniRouteStatus,
} from "../core/omniroute";
import type { Settings } from "../core/state";
import { h, clear } from "../views/dom";
import { t } from "../i18n/i18n";
import { statusDot } from "./parts";

/** What the page lends the card. `settings()` is the page's current object, edited in place. */
export interface OmniRouteHost {
  settings(): Settings;
  save(): Promise<void>;
  toggle(on: boolean, onChange: (v: boolean) => void): HTMLElement;
}

const S = {
  get intro() { return t("OmniRoute is a router you run on your computer, in front of every AI provider and account you connect to it. Coucou can chat with its models and combos, and send its own AI features through it."); },
  get use() { return t("Use OmniRoute"); },
  get checking() { return t("Connecting…"); },
  get notInstalled() { return t("OmniRoute isn't installed on this computer."); },
  get installHow() { return t("Install it once from its official source, with Node.js 22 or later, then come back: Coucou starts it for you."); },
  get copy() { return t("Copy"); },
  get copied() { return t("Copied"); },
  get stopped() { return t("Installed, not running."); },
  get start() { return t("Start OmniRoute"); },
  get starting() { return t("Starting OmniRoute…"); },
  get keyNeeded() { return t("It asks for an API key: create one in its dashboard, under API Manager, then paste it here."); },
  get keyRefused() { return t("It refused this key: create a new one in its dashboard, then paste it here."); },
  get empty() { return t("Running, but no models yet: connect a provider in its dashboard."); },
  ready: (count: number) => t("Connected · {count} models", { count }),
  unreachable: (url: string) => t("Cannot reach {url}. Is the server running?", { url }),
  get dashboard() { return t("Open dashboard"); },
  get address() { return t("Address"); },
  get apiKey() { return t("API key"); },
  get stored() { return t("(stored)"); },
  get keyOptional() { return t("API key (optional)"); },
  get save() { return t("Save"); },
  get remove() { return t("Remove"); },
  get useInChat() { return t("Use in chat"); },
  get inUse() { return t("In use"); },
  get features() { return t("Coucou's AI features"); },
  get featuresHint() { return t("Dictation clean-up, Notetaker summaries and « OK Coucou » go through OmniRoute with this model, instead of your Anthropic key. What you dictate and record then goes to the providers behind it."); },
  get model() { return t("Model"); },
};

export function omnirouteSection(host: OmniRouteHost): HTMLElement {
  const body = h("div", { style: "display:flex;flex-direction:column;gap:12px" });
  let status: OmniRouteStatus | null = null;
  let hasKey = false;
  let busy: string | null = null;
  /** Bumped by every refresh, so an older answer never overwrites a newer one. */
  let asked = 0;

  const config = (): OmniRouteConfig => omnirouteConfig(host.settings());
  const update = async (change: Partial<OmniRouteConfig>) => {
    host.settings().omniroute = { ...config(), ...change };
    await host.save();
  };

  /** Asks omniroute.rs again, then settles what follows from the answer. */
  async function refresh() {
    const ticket = ++asked;
    hasKey = (await Bridge.secretPresent("omniroute-api-key")) ?? false;
    const fresh = await OmniRouteBridge.status().catch((err) => failed(err));
    if (ticket !== asked) return;
    status = fresh;
    await settle();
    draw();
  }

  function failed(err: unknown): OmniRouteStatus {
    return {
      url: config().url || DEFAULT_URL, local: true, installed: false, running: false,
      key: "none", models: [], error: String(err).replace(/^Error:\s*/, ""),
    };
  }

  /** Once its models are known: the features' model and the chat's are ones it has. */
  async function settle() {
    const offered = status?.models ?? [];
    if (!offered.length) return;
    const settings = host.settings();
    const chosen = featuresModel(config().featuresModel, offered);
    const chatModel = settings.chatModels.omniroute ?? "";
    if (chosen === config().featuresModel && offered.includes(chatModel)) return;
    settings.chatModels = { ...settings.chatModels, omniroute: offered.includes(chatModel) ? chatModel : chosen };
    await update({ featuresModel: chosen });
  }

  async function start() {
    busy = S.starting;
    draw();
    try {
      status = await OmniRouteBridge.start();
      busy = null;
      await settle();
    } catch (err) {
      busy = null;
      status = failed(err);
    }
    draw();
  }

  function draw() {
    clear(body);
    const on = config().enabled;
    body.append(
      h("div", { class: "row" },
        h("label", {}, h("i", { class: "dot", style: "background:#8B5CF6;margin-right:8px" }), h("span", { text: S.use })),
        h("span", { style: "flex:1 1 auto" }),
        host.toggle(on, (next) => void turn(next)),
      ),
    );
    if (!on) return;
    body.append(stateBlock());
    if (status && !status.running && status.local && !status.installed && !busy) body.append(installGuide());
    body.append(addressRow(), keyRow());
    if (status?.models.length) body.append(featuresBlock(status.models));
  }

  async function turn(next: boolean) {
    const settings = host.settings();
    if (!next && settings.chatProvider === "omniroute") settings.chatProvider = "anthropic";
    await update({ enabled: next });
    if (!next) return draw();
    busy = S.checking;
    draw();
    await refresh();
    busy = null;
    // Turned on: started if it can be, and the chat goes to it once it answers.
    if (stage(config(), status) === "stopped") await start();
    if (stage(config(), status) === "ready") {
      host.settings().chatProvider = "omniroute";
      await host.save();
    }
    draw();
  }

  /** Where it stands, in one line, with the one action that moves it forward. */
  function stateBlock(): HTMLElement {
    const row = h("div", { class: "row" });
    if (busy) {
      row.append(h("div", { class: "hint", text: busy }));
      return row;
    }
    const now = stage(config(), status);
    const line = (ok: boolean, text: string) => row.append(statusDot(ok), h("span", { text, style: "flex:1 1 auto;min-width:0" }));
    switch (now) {
      case "not-installed":
        line(false, S.notInstalled);
        break;
      case "stopped": {
        line(false, S.stopped);
        const go = h("button", { class: "primary", text: S.start });
        go.addEventListener("click", () => void start());
        row.append(go);
        break;
      }
      case "key":
      case "refused":
        line(false, now === "key" ? S.keyNeeded : S.keyRefused);
        row.append(dashboardButton());
        break;
      case "empty":
        line(false, S.empty);
        row.append(dashboardButton());
        break;
      case "ready": {
        line(true, S.ready(status!.models.length));
        const inUse = host.settings().chatProvider === "omniroute";
        const use = h("button", { class: inUse ? "" : "primary", text: inUse ? S.inUse : S.useInChat });
        use.disabled = inUse;
        use.addEventListener("click", async () => {
          host.settings().chatProvider = "omniroute";
          await host.save();
          draw();
        });
        row.append(dashboardButton(), use);
        break;
      }
      default:
        line(false, status?.error || S.unreachable(status?.url || DEFAULT_URL));
    }
    return row;
  }

  function dashboardButton(): HTMLElement {
    const b = h("button", { text: S.dashboard });
    b.addEventListener("click", () => void OmniRouteBridge.dashboard().catch(() => {}));
    return b;
  }

  /** Not installed: where it comes from, and the one command that installs it. */
  function installGuide(): HTMLElement {
    const copy = h("button", { text: S.copy });
    copy.addEventListener("click", async () => {
      await navigator.clipboard.writeText(INSTALL_COMMAND).catch(() => {});
      copy.textContent = S.copied;
    });
    const site = h("button", { text: "omniroute.online" });
    site.addEventListener("click", () => void Bridge.openUrl(SITE_URL));
    const repo = h("button", { text: "GitHub" });
    repo.addEventListener("click", () => void Bridge.openUrl(REPO_URL));
    const again = h("button", { text: S.start });
    again.addEventListener("click", () => void refresh().then(() => stage(config(), status) === "stopped" ? start() : undefined));
    return h("div", { style: "display:flex;flex-direction:column;gap:8px" },
      h("div", { class: "hint", text: S.installHow }),
      h("div", { class: "row" },
        h("code", { class: "path", text: INSTALL_COMMAND, style: "flex:1 1 auto;user-select:text" }),
        copy, site, repo, again,
      ),
    );
  }

  function addressRow(): HTMLElement {
    const input = h("input", {
      type: "text",
      placeholder: DEFAULT_URL,
      value: config().url,
      style: "flex:1 1 auto;min-width:0",
      spellcheck: "false",
      autocomplete: "off",
    }) as HTMLInputElement;
    input.addEventListener("change", async () => {
      // The key stays with the address it was entered for: a new one needs it again.
      await update({ url: input.value.trim() });
      await refresh();
    });
    return h("div", { class: "row" }, h("label", { text: S.address }), input);
  }

  function keyRow(): HTMLElement {
    const input = h("input", {
      type: "password",
      placeholder: hasKey ? S.stored : S.keyOptional,
      style: "flex:1 1 auto;min-width:0",
      autocomplete: "off",
      spellcheck: "false",
    }) as HTMLInputElement;
    const save = h("button", { class: "primary", text: S.save });
    const error = h("div", {});
    save.addEventListener("click", async () => {
      if (!input.value.trim()) return;
      try {
        await OmniRouteBridge.setKey(config().url, input.value.trim());
        input.value = "";
        await refresh();
      } catch (err) {
        clear(error);
        error.append(h("div", { class: "notice err", text: String(err).replace(/^Error:\s*/, "") }));
      }
    });
    const row = h("div", { class: "row" }, h("label", { text: S.apiKey }), input, save);
    if (hasKey) {
      const remove = h("button", { class: "danger", text: S.remove });
      remove.addEventListener("click", async () => {
        await OmniRouteBridge.setKey(config().url, "").catch(() => {});
        await refresh();
      });
      row.append(remove);
    }
    return h("div", { style: "display:flex;flex-direction:column;gap:6px" }, row, error);
  }

  /** Dictation, the Notetaker and « OK Coucou » through it, with their model. */
  function featuresBlock(models: string[]): HTMLElement {
    const block = h("div", { style: "display:flex;flex-direction:column;gap:6px" },
      h("div", { class: "row" },
        h("label", { text: S.features }),
        h("span", { style: "flex:1 1 auto" }),
        host.toggle(config().features, (next) => void update({ features: next }).then(draw)),
      ),
      h("div", { class: "hint", text: S.featuresHint }),
    );
    if (config().features) {
      const select = h("select", { style: "flex:1 1 auto;min-width:0" }) as HTMLSelectElement;
      for (const id of models) select.append(h("option", { value: id, text: id }));
      select.value = config().featuresModel;
      select.addEventListener("change", () => void update({ featuresModel: select.value }));
      block.append(h("div", { class: "row" }, h("label", { text: S.model }), select));
    }
    return block;
  }

  draw();
  if (config().enabled) {
    busy = S.checking;
    draw();
    void refresh().then(() => {
      busy = null;
      draw();
    });
  }
  return h("section", {},
    h("h2", {}, h("span", { text: "OmniRoute" })),
    h("div", { class: "hint", text: S.intro }),
    body,
  );
}
