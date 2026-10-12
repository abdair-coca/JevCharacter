// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CreatureLoader from "../src/features/loading/CreatureLoader";

afterEach(cleanup);

describe("CreatureLoader", () => {
  it("renders three decorative dots with no text", () => {
    const { container } = render(<CreatureLoader visible active reduced={false} />);
    expect(container.querySelectorAll(".creature-loader__dot")).toHaveLength(3);
    expect(container.querySelector(".creature-loader")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.textContent).toBe("");
  });

  it("reflects visibility, activity and reduced motion on the wrapper", () => {
    const { container, rerender } = render(<CreatureLoader visible active reduced={false} />);
    const wrapper = container.querySelector(".creature-loader")!;
    expect(wrapper.getAttribute("data-visible")).toBe("true");
    expect(wrapper.getAttribute("data-active")).toBe("true");
    expect(wrapper.getAttribute("data-reduced")).toBe("false");

    rerender(<CreatureLoader visible={false} active={false} reduced />);
    expect(wrapper.getAttribute("data-visible")).toBe("false");
    expect(wrapper.getAttribute("data-active")).toBe("false");
    expect(wrapper.getAttribute("data-reduced")).toBe("true");
  });
});
