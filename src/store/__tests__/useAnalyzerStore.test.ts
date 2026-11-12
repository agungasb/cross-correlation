import { describe, it, expect, beforeEach } from "vitest";
import { useAnalyzerStore } from "../useAnalyzerStore";

describe("useAnalyzerStore - trailLength bounds", () => {
  beforeEach(() => {
    useAnalyzerStore.setState({ trailLength: 250 });
  });

  it("allows setting sliding trail length down to 10b", () => {
    const { setTrailLength } = useAnalyzerStore.getState();
    setTrailLength(10);
    expect(useAnalyzerStore.getState().trailLength).toBe(10);
  });

  it("clamps trail length to minimum 10 when lower values are passed", () => {
    const { setTrailLength } = useAnalyzerStore.getState();
    setTrailLength(0);
    expect(useAnalyzerStore.getState().trailLength).toBe(10);

    setTrailLength(-50);
    expect(useAnalyzerStore.getState().trailLength).toBe(10);

    setTrailLength(9);
    expect(useAnalyzerStore.getState().trailLength).toBe(10);
  });

  it("supports values between 10 and 800 including legacy 30b", () => {
    const { setTrailLength } = useAnalyzerStore.getState();
    setTrailLength(30);
    expect(useAnalyzerStore.getState().trailLength).toBe(30);

    setTrailLength(120);
    expect(useAnalyzerStore.getState().trailLength).toBe(120);

    setTrailLength(800);
    expect(useAnalyzerStore.getState().trailLength).toBe(800);
  });

  it("clamps trail length to maximum 800", () => {
    const { setTrailLength } = useAnalyzerStore.getState();
    setTrailLength(1000);
    expect(useAnalyzerStore.getState().trailLength).toBe(800);
  });
});
