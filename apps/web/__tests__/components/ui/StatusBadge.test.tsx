import React from "react";
import { render, screen } from "@testing-library/react";
import StatusBadge from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  const cases = [
    { status: "realizado" as const, label: "Realizado" },
    { status: "agendado" as const, label: "Agendado" },
    { status: "sem-agendamento" as const, label: "Sem Agendamento" },
    { status: "critico" as const, label: "Crítico" },
    { status: "atencao" as const, label: "Atenção" },
  ];

  cases.forEach(({ status, label }) => {
    it(`renders "${label}" for status "${status}"`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("applies additional className", () => {
    render(<StatusBadge status="realizado" className="extra-class" />);
    const badge = screen.getByText("Realizado");
    expect(badge).toHaveClass("extra-class");
  });

  it("renders as a span element", () => {
    render(<StatusBadge status="agendado" />);
    expect(screen.getByText("Agendado").tagName).toBe("SPAN");
  });
});
