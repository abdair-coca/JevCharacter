// @vitest-environment jsdom
import { cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createUiSound, uiSoundFor, useUiSounds, type UiSound } from "../src/lib/uiSound";
import { FakeContext, fakeCore, reaches, type FakeNode } from "./audioFakes";

afterEach(() => { cleanup(); vi.useRealTimers(); });

function control(markup: string) {
  const { container } = render(<div dangerouslySetInnerHTML={{ __html: markup }} />);
  return container.querySelector("[data-target]")!;
}

describe("interface sounds", () => {
  it("names the sound by what the press does, read before the control changes", () => {
    expect(uiSoundFor(control('<button data-target>Guardar</button>'))).toBe("tap");
    expect(uiSoundFor(control('<a href="/features" data-target>Capacidades</a>'))).toBe("navigate");
    expect(uiSoundFor(control('<a href="https://github.com/abdair-coca" data-target>GitHub</a>'))).toBe("tap");
    expect(uiSoundFor(control('<button aria-pressed="false" data-target>Sonido</button>'))).toBe("on");
    expect(uiSoundFor(control('<button aria-pressed="true" data-target>Sonido</button>'))).toBe("off");
    expect(uiSoundFor(control('<button aria-expanded="false" data-target>Detalles</button>'))).toBe("on");
    expect(uiSoundFor(control('<div role="group"><button aria-pressed="false" data-target>Cian</button></div>'))).toBe("select");
    expect(uiSoundFor(control('<div role="group"><button aria-pressed="true" data-target>Cian</button></div>'))).toBe("tap");
  });

  it("stays quiet for disabled controls and for anything that is not a control", () => {
    expect(uiSoundFor(control('<button disabled data-target>Enviar</button>'))).toBeNull();
    expect(uiSoundFor(control('<button aria-disabled="true" data-target>Enviar</button>'))).toBeNull();
    expect(uiSoundFor(control('<p data-target>Texto</p>'))).toBeNull();
    // A press on an icon inside a button belongs to the button.
    expect(uiSoundFor(control('<button><svg data-target></svg></button>'))).toBe("tap");
  });

  it("plays short blips on the dry ui bus only while sound is audible", () => {
    const context = new FakeContext();
    const core = fakeCore(context);
    let time = 0;
    const sound = createUiSound({ core, now: () => time });
    sound.play("tap");
    expect(context.oscillators).toHaveLength(0);
    core.unlock();
    sound.play("on");
    expect(context.oscillators).toHaveLength(2);
    for (const tone of context.oscillators) expect(reaches(tone, core.bus("ui") as unknown as FakeNode)).toBe(true);
    expect(reaches(context.oscillators[0], context.convolvers[0])).toBe(false);
    // A second press inside the gap is the same gesture.
    time = 20;
    sound.play("tap");
    expect(context.oscillators).toHaveLength(2);
    time = 200;
    core.setEnabled(false);
    sound.play("tap");
    expect(context.oscillators).toHaveLength(2);
  });

  it("clicks after the press handlers ran, and never while disabled for Historia", () => {
    vi.useFakeTimers();
    const sound: UiSound = { play: vi.fn() };
    const { rerender } = renderHook(({ enabled }) => useUiSounds(enabled, sound), { initialProps: { enabled: true } });
    const button = control('<button aria-pressed="false" data-target>Sonido</button>') as HTMLButtonElement;
    // The handler flips the state; the sound still reflects the press it answered.
    button.addEventListener("click", () => button.setAttribute("aria-pressed", "true"));
    button.click();
    expect(sound.play).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(sound.play).toHaveBeenCalledWith("on");
    rerender({ enabled: false });
    button.click();
    vi.runAllTimers();
    expect(sound.play).toHaveBeenCalledOnce();
  });
});
