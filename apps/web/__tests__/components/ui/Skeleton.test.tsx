import React from "react";
import { render, screen, within } from "@testing-library/react";
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  it("renders a div with animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("merges additional className", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveClass("h-4", "w-20", "animate-pulse");
  });
});

describe("SkeletonCard", () => {
  it("renders three skeleton bars inside a card", () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });
});

describe("SkeletonTable", () => {
  it("renders the default 5 rows", () => {
    const { container } = render(<SkeletonTable />);
    // Each row has 5 skeleton cells + the header row's 5 cells = 10 × 2... or just check divs
    const rows = container.querySelectorAll(".border-t");
    expect(rows.length).toBe(5);
  });

  it("renders the specified number of rows", () => {
    const { container } = render(<SkeletonTable rows={3} />);
    const rows = container.querySelectorAll(".border-t");
    expect(rows.length).toBe(3);
  });
});

describe("SkeletonDashboard", () => {
  it("renders 4 skeleton cards in the grid", () => {
    const { container } = render(<SkeletonDashboard />);
    // 4 SkeletonCard wrappers each have a div with border-white/8
    const cards = container.querySelectorAll(".rounded-xl.border");
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });
});
