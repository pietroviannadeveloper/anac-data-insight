import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const defaultProps = {
  open: true,
  title: "Excluir arquivo",
  description: "Esta ação não pode ser desfeita.",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe("ConfirmDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when open=false", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders title and description when open=true", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Excluir arquivo")).toBeInTheDocument();
    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
  });

  it("uses default label 'Confirmar' and 'Cancelar'", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Confirmar")).toBeInTheDocument();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
  });

  it("uses custom confirmLabel and cancelLabel", () => {
    render(
      <ConfirmDialog {...defaultProps} confirmLabel="Deletar" cancelLabel="Voltar" />
    );
    expect(screen.getByText("Deletar")).toBeInTheDocument();
    expect(screen.getByText("Voltar")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Confirmar"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when close (X) button is clicked", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on backdrop click", () => {
    const { container } = render(<ConfirmDialog {...defaultProps} />);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Escape key is pressed", () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when loading=true", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);
    expect(screen.getByText("Confirmar").closest("button")).toBeDisabled();
    expect(screen.getByText("Cancelar").closest("button")).toBeDisabled();
  });

  it("applies danger styling when danger=true", () => {
    render(<ConfirmDialog {...defaultProps} danger={true} />);
    const confirmBtn = screen.getByText("Confirmar").closest("button");
    expect(confirmBtn?.className).toMatch(/red/);
  });

  it("has role=dialog and aria-modal attributes", () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-title");
  });
});
